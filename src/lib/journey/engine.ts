/**
 * JOURNEY ENGINE — núcleo de inteligência do Portal Velox (Épico 7A/7B).
 *
 * Fonte ÚNICA de verdade da jornada do investidor. Nenhum módulo mantém
 * rastreamento próprio: Portal, Manual, Material Institucional,
 * Simulador, IA, Workspace, Green Sales, Brain Analytics, Central de
 * Alertas e Painel de Campanhas consomem exatamente os mesmos eventos
 * produzidos aqui.
 *
 * Princípios:
 *  1. Todo investidor identificado gera imediatamente um Lead.
 *  2. Toda interação vira evento — nunca depende de ação manual.
 *  3. Sessões são inteligentes: permanecem ativas enquanto houver
 *     navegação e encerram após ~1h sem qualquer interação.
 *  4. Só é contabilizado tempo EFETIVO de interação (nunca tempo parado).
 *  5. O registro acontece em segundo plano, de forma silenciosa.
 */
import { emitEvent, type PortalEventType } from "@/lib/events/bus";

const JOURNEY_KEY = "velox:journey:v1";
/** Sessão encerra após ~1 hora sem qualquer interação. */
export const SESSION_IDLE_MS = 60 * 60 * 1000;
/** Intervalo máximo aceito entre dois sinais para contar tempo efetivo. */
const MAX_TICK_MS = 60 * 1000;

export type JourneyModule =
  | "portal"
  | "manual"
  | "material"
  | "simulador"
  | "ia"
  | "contato"
  | "reuniao";

export type JourneyStage =
  | "identificado"
  | "lendo"
  | "manual_concluido"
  | "simulando"
  | "em_contato"
  | "jornada_concluida";

export type JourneyTimelineEntry = {
  at: string;
  type: PortalEventType;
  label: string;
  module: JourneyModule;
  detail?: string;
  sessionId: string;
};

export type JourneySession = {
  id: string;
  index: number;
  startedAt: string;
  lastActivityAt: string;
  endedAt: string | null;
  /** Tempo efetivo de interação (ms) — nunca tempo parado. */
  effectiveMs: number;
  /** Tempo efetivo por módulo (ms). */
  moduleMs: Partial<Record<JourneyModule, number>>;
  events: { at: string; label: string; module: JourneyModule; detail?: string }[];
  /** Resumo interno gerado automaticamente ao encerrar a sessão. */
  summary?: string;
  device: string;
  origin: string;
  campaign: string | null;
};

export type JourneyProgress = {
  module: JourneyModule;
  chapterSlug: string | null;
  chapterTitle: string | null;
  chapterIndex: number;
  totalChapters: number;
  percent: number;
  completedChapters: string[];
  modulesStarted: JourneyModule[];
  modulesCompleted: JourneyModule[];
};

export type JourneyCounters = {
  sessions: number;
  returns: number;
  chapters: number;
  aiQueries: number;
  simulations: number;
  whatsapp: number;
  meetings: number;
};

export type JourneyRecord = {
  investorId: string;
  identityId: string | null;
  name: string;
  email: string;
  phone: string | null;
  executiveId: string | null;
  executiveSlug: string | null;
  unit: string | null;
  origin: string;
  campaign: string | null;
  link: string | null;
  personalized: boolean;
  device: string;
  createdAt: string;
  firstAccessAt: string;
  lastActivityAt: string;
  effectiveMs: number;
  moduleMs: Partial<Record<JourneyModule, number>>;
  counters: JourneyCounters;
  progress: JourneyProgress;
  sessions: JourneySession[];
  timeline: JourneyTimelineEntry[];
};

type JourneyMap = Record<string, JourneyRecord>;

/* --------------------------------- storage -------------------------------- */

function read(): JourneyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(JOURNEY_KEY);
    const parsed = raw ? (JSON.parse(raw) as JourneyMap) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map: JourneyMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JOURNEY_KEY, JSON.stringify(map));
  } catch {
    /* histórico é best-effort — nunca bloqueia a navegação */
  }
}

/** Toda escrita acontece em segundo plano: nunca bloqueia a interface. */
function background(fn: () => void) {
  if (typeof window === "undefined") {
    return;
  }
  const run = () => {
    try {
      fn();
    } catch {
      /* silencioso por definição */
    }
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (typeof ric === "function") ric(run);
  else window.setTimeout(run, 0);
}

/* --------------------------------- helpers -------------------------------- */

export const JOURNEY_EVENT_LABEL: Partial<Record<PortalEventType, string>> = {
  "journey.started": "Jornada iniciada",
  "journey.lead.created": "Lead criado automaticamente",
  "journey.session.started": "Nova sessão iniciada",
  "journey.session.ended": "Sessão encerrada",
  "journey.returned": "Retornou ao Portal",
  "journey.module.opened": "Abriu um módulo",
  "journey.progress": "Avançou na jornada",
  "journey.completed": "Concluiu a jornada",
  "manual.started": "Iniciou o Manual",
  "manual.chapter.completed": "Concluiu um capítulo",
  "manual.completed": "Concluiu o Manual",
  "material.viewed": "Acessou o Material Institucional",
  "simulator.started": "Iniciou o Simulador",
  "simulator.completed": "Concluiu uma simulação",
  "ai.query.answered": "Realizou pergunta à IA",
  "profile.interests.captured": "Registrou interesses",
  "whatsapp.requested": "Solicitou atendimento por WhatsApp",
  "meeting.requested": "Solicitou reunião",
  "meeting.created": "Reunião agendada",
  "meeting.confirmed": "Reunião confirmada",
};

const MODULE_BY_EVENT: Partial<Record<PortalEventType, JourneyModule>> = {
  "manual.started": "manual",
  "manual.chapter.completed": "manual",
  "manual.completed": "manual",
  "material.viewed": "material",
  "simulator.started": "simulador",
  "simulator.completed": "simulador",
  "ai.query.answered": "ia",
  "whatsapp.requested": "contato",
  "meeting.requested": "reuniao",
  "meeting.created": "reuniao",
  "meeting.confirmed": "reuniao",
};

export const MODULE_LABEL: Record<JourneyModule, string> = {
  portal: "Portal",
  manual: "Manual do Investidor",
  material: "Material Institucional",
  simulador: "Simulador",
  ia: "Assistente de IA",
  contato: "Contato comercial",
  reuniao: "Reuniões",
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyProgress(): JourneyProgress {
  return {
    module: "portal",
    chapterSlug: null,
    chapterTitle: null,
    chapterIndex: 0,
    totalChapters: 0,
    percent: 0,
    completedChapters: [],
    modulesStarted: ["portal"],
    modulesCompleted: [],
  };
}

function emptyCounters(): JourneyCounters {
  return {
    sessions: 0,
    returns: 0,
    chapters: 0,
    aiQueries: 0,
    simulations: 0,
    whatsapp: 0,
    meetings: 0,
  };
}

function openSession(record: JourneyRecord, at: string): JourneySession {
  const session: JourneySession = {
    id: newId("ses"),
    index: record.sessions.length + 1,
    startedAt: at,
    lastActivityAt: at,
    endedAt: null,
    effectiveMs: 0,
    moduleMs: {},
    events: [],
    device: record.device,
    origin: record.origin,
    campaign: record.campaign,
  };
  record.sessions.push(session);
  record.counters.sessions += 1;
  return session;
}

function buildSummary(session: JourneySession): string {
  const start = new Date(session.startedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const minutes = Math.max(1, Math.round(session.effectiveMs / 60000));
  const steps = session.events.slice(0, 8).map((e) => e.detail ?? e.label);
  const uniqueSteps = steps.filter((s, i) => steps.indexOf(s) === i);
  return [
    `Sessão iniciada às ${start}.`,
    ...uniqueSteps,
    `Tempo efetivo de ${minutes} min.`,
    "Sessão encerrada.",
  ].join(" ↓ ");
}

function closeSession(record: JourneyRecord, session: JourneySession, at: string) {
  session.endedAt = at;
  session.summary = buildSummary(session);
}

/**
 * Garante que exista uma sessão ativa. Se a última sessão ficou mais de
 * uma hora sem interação, ela é encerrada (com resumo automático) e uma
 * nova sessão é aberta — gerando nova oportunidade para o Executivo.
 */
function ensureActiveSession(
  record: JourneyRecord,
  now: number,
): { session: JourneySession; renewed: boolean } {
  const current = record.sessions[record.sessions.length - 1];
  if (!current || current.endedAt) {
    return { session: openSession(record, new Date(now).toISOString()), renewed: Boolean(current) };
  }
  const idle = now - Date.parse(current.lastActivityAt);
  if (idle > SESSION_IDLE_MS) {
    closeSession(record, current, current.lastActivityAt);
    record.counters.returns += 1;
    return { session: openSession(record, new Date(now).toISOString()), renewed: true };
  }
  return { session: current, renewed: false };
}

/* ---------------------------------- API ----------------------------------- */

export function listJourneys(): JourneyRecord[] {
  return Object.values(read()).sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
}

export function getJourney(investorId?: string | null): JourneyRecord | null {
  if (!investorId) return null;
  return read()[investorId] ?? null;
}

/**
 * Registra (ou restaura) a jornada de um investidor identificado. É
 * chamada pelo Gateway imediatamente após a criação automática do Lead.
 */
export function registerJourney(input: {
  investorId: string;
  identityId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  executiveId?: string | null;
  executiveSlug?: string | null;
  unit?: string | null;
  origin?: string | null;
  campaign?: string | null;
  link?: string | null;
  personalized?: boolean;
  device?: string;
  restored?: boolean;
}): JourneyRecord {
  const map = read();
  const now = new Date().toISOString();
  const existing = map[input.investorId];

  const record: JourneyRecord = existing ?? {
    investorId: input.investorId,
    identityId: input.identityId ?? null,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    executiveId: input.executiveId ?? null,
    executiveSlug: input.executiveSlug ?? null,
    unit: input.unit ?? null,
    origin: input.origin ?? "Portal Velox",
    campaign: input.campaign ?? null,
    link: input.link ?? null,
    personalized: Boolean(input.personalized),
    device: input.device ?? "desconhecido",
    createdAt: now,
    firstAccessAt: now,
    lastActivityAt: now,
    effectiveMs: 0,
    moduleMs: {},
    counters: emptyCounters(),
    progress: emptyProgress(),
    sessions: [],
    timeline: [],
  };

  // Contexto comercial é sempre atualizado (link/campanha/executivo).
  record.name = input.name || record.name;
  record.email = input.email || record.email;
  record.phone = input.phone ?? record.phone;
  record.identityId = input.identityId ?? record.identityId;
  record.executiveId = input.executiveId ?? record.executiveId;
  record.executiveSlug = input.executiveSlug ?? record.executiveSlug;
  record.unit = input.unit ?? record.unit;
  record.origin = input.origin ?? record.origin;
  record.campaign = input.campaign ?? record.campaign;
  record.link = input.link ?? record.link;
  record.personalized = input.personalized ?? record.personalized;
  record.device = input.device ?? record.device;
  record.lastActivityAt = now;

  const { session, renewed } = ensureActiveSession(record, Date.now());
  map[record.investorId] = record;
  write(map);

  if (!existing) {
    trackJourney({
      investorId: record.investorId,
      type: "journey.lead.created",
      detail: "Lead criado automaticamente na identificação",
      module: "portal",
    });
  } else if (renewed) {
    trackJourney({
      investorId: record.investorId,
      type: "journey.returned",
      detail: `Retorno ao Portal — sessão ${session.index}`,
      module: "portal",
    });
  }
  trackJourney({
    investorId: record.investorId,
    type: "journey.session.started",
    detail: `Sessão ${session.index} iniciada`,
    module: "portal",
  });

  return read()[record.investorId] ?? record;
}

export type TrackInput = {
  investorId?: string | null;
  type: PortalEventType;
  module?: JourneyModule;
  detail?: string;
  payload?: Record<string, unknown>;
  actorId?: string | null;
};

/**
 * Ponto ÚNICO de entrada de eventos da plataforma. Atualiza sessão,
 * progresso, contadores, timeline e propaga para o barramento — que
 * alimenta Workspace, Green Sales, Alertas, Brain e Campanhas.
 */
export function trackJourney(input: TrackInput) {
  const label = JOURNEY_EVENT_LABEL[input.type] ?? input.type;
  const module = input.module ?? MODULE_BY_EVENT[input.type] ?? "portal";

  // 1) Emissão imediata (consumidores em tempo real).
  emitEvent({
    type: input.type,
    investorId: input.investorId ?? null,
    actorId: input.actorId ?? null,
    payload: { ...(input.payload ?? {}), module, label, detail: input.detail ?? null },
  });

  // 2) Persistência da jornada em segundo plano.
  if (!input.investorId) return;
  const investorId = input.investorId;
  background(() => {
    const map = read();
    const record = map[investorId];
    if (!record) return;
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const { session, renewed } = ensureActiveSession(record, nowMs);

    session.lastActivityAt = now;
    record.lastActivityAt = now;

    const entry: JourneyTimelineEntry = {
      at: now,
      type: input.type,
      label,
      module,
      detail: input.detail,
      sessionId: session.id,
    };
    record.timeline.push(entry);
    record.timeline = record.timeline.slice(-400);
    session.events.push({ at: now, label, module, detail: input.detail });

    applyEventToState(record, input, module);

    if (renewed) record.counters.returns = record.counters.returns;
    map[investorId] = record;
    write(map);
  });
}

function pushUnique<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list : [...list, value];
}

function applyEventToState(record: JourneyRecord, input: TrackInput, module: JourneyModule) {
  const payload = (input.payload ?? {}) as {
    index?: number;
    total?: number;
    chapterSlug?: string;
    chapterTitle?: string;
  };
  record.progress.module = module;
  record.progress.modulesStarted = pushUnique(record.progress.modulesStarted, module);

  switch (input.type) {
    case "manual.chapter.completed": {
      if (payload.chapterSlug) {
        record.progress.completedChapters = pushUnique(
          record.progress.completedChapters,
          payload.chapterSlug,
        );
        record.progress.chapterSlug = payload.chapterSlug;
      }
      record.progress.chapterTitle = payload.chapterTitle ?? record.progress.chapterTitle;
      record.progress.chapterIndex = payload.index ?? record.progress.chapterIndex;
      record.progress.totalChapters = payload.total ?? record.progress.totalChapters;
      record.counters.chapters = record.progress.completedChapters.length;
      if (payload.index && payload.total) {
        record.progress.percent = Math.min(
          100,
          Math.round((payload.index / payload.total) * 100),
        );
      }
      break;
    }
    case "manual.completed":
      record.progress.percent = 100;
      record.progress.modulesCompleted = pushUnique(record.progress.modulesCompleted, "manual");
      break;
    case "simulator.completed":
      record.counters.simulations += 1;
      record.progress.modulesCompleted = pushUnique(record.progress.modulesCompleted, "simulador");
      break;
    case "ai.query.answered":
      record.counters.aiQueries += 1;
      break;
    case "whatsapp.requested":
      record.counters.whatsapp += 1;
      break;
    case "meeting.requested":
    case "meeting.created":
    case "meeting.confirmed":
      record.counters.meetings += 1;
      break;
    case "material.viewed":
      record.progress.modulesCompleted = pushUnique(record.progress.modulesCompleted, "material");
      break;
    default:
      break;
  }
}

/**
 * Sinal de vida da navegação (heartbeat). Soma apenas tempo EFETIVO de
 * interação e nunca tempo parado: intervalos maiores que um minuto são
 * descartados.
 */
export function heartbeat(investorId: string | null | undefined, module: JourneyModule = "portal") {
  if (!investorId) return;
  background(() => {
    const map = read();
    const record = map[investorId];
    if (!record) return;
    const nowMs = Date.now();
    const { session, renewed } = ensureActiveSession(record, nowMs);
    const delta = nowMs - Date.parse(session.lastActivityAt);
    if (!renewed && delta > 0 && delta <= MAX_TICK_MS) {
      session.effectiveMs += delta;
      session.moduleMs[module] = (session.moduleMs[module] ?? 0) + delta;
      record.effectiveMs += delta;
      record.moduleMs[module] = (record.moduleMs[module] ?? 0) + delta;
    }
    session.lastActivityAt = new Date(nowMs).toISOString();
    record.lastActivityAt = session.lastActivityAt;
    record.progress.module = module;
    record.progress.modulesStarted = pushUnique(record.progress.modulesStarted, module);
    map[investorId] = record;
    write(map);
  });
}

/** Encerra sessões inativas de todos os investidores (varredura silenciosa). */
export function sweepIdleSessions(): JourneyRecord[] {
  const map = read();
  const now = Date.now();
  const closed: JourneyRecord[] = [];
  for (const record of Object.values(map)) {
    const current = record.sessions[record.sessions.length - 1];
    if (!current || current.endedAt) continue;
    if (now - Date.parse(current.lastActivityAt) > SESSION_IDLE_MS) {
      closeSession(record, current, current.lastActivityAt);
      closed.push(record);
    }
  }
  if (closed.length) write(map);
  return closed;
}