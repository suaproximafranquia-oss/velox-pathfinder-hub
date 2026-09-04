/**
 * SIMULADOR BILATERAL DA HOMOLOGAÇÃO (COMANDO 3A).
 *
 * Executa os dois lados da conversa — Executivo/sistema e investidor
 * fictício — usando EXATAMENTE o mesmo motor da produção. Muda apenas o
 * repositório (memória da rodada), o despachante (mensagem simulada) e o
 * relógio (avanço virtual controlado).
 *
 * Nada aqui toca produção, Portal dos Leads, GreenSales ou WhatsApp: o
 * despachante só aceita leads com prefixo TEST- e nunca chama API real.
 */
import { RELATIONSHIP_CONFIG, type RelationshipConfig } from "./config";
import { isEligibleMoment, nextEligibleMoment, operationalDate } from "./calendar";
import { createEngine } from "./engine";
import { initialRecord } from "./machine";
import { renderHomologationMessage } from "./messages";
import { isPlausibleName, normalizeName } from "./names";
import type { EngineDispatcher, EngineRepository } from "./ports";
import type {
  CadenceRecord,
  CadenceState,
  CadenceStep,
  EngineDecision,
  EngineEvent,
  QueueItem,
} from "./types";

export const HOMOLOGATION_PREFIX = "TEST-";

/**
 * A homologação NÃO tem mais biblioteca de conteúdo separada: o link
 * pertence à própria mensagem. O tipo permanece apenas para manter a
 * forma dos relatórios já gravados.
 */
export type SimContent = {
  id: string;
  name: string;
  url: string | null;
  active: boolean;
  usageCount: number;
};

/* ------------------------------------------------------------------ */
/* Aleatoriedade determinística — a mesma semente reproduz a rodada.    */
/* ------------------------------------------------------------------ */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Cenários                                                            */
/* ------------------------------------------------------------------ */
export type ScenarioKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export type ScenarioDefinition = {
  key: ScenarioKey;
  name: string;
  /** Comportamento esperado descrito em linguagem de negócio. */
  expectation: string;
  expectedSteps: CadenceStep[];
  expectedStates: CadenceState[];
};

export const SCENARIOS: Record<ScenarioKey, ScenarioDefinition> = {
  A: {
    key: "A",
    name: "Não visualiza nada",
    expectation: "E0 → E1 → E3 → E4 → E12 e encerramento sem resposta.",
    expectedSteps: ["E0", "E1", "E3", "E4", "E12"],
    expectedStates: ["COMPLETED"],
  },
  B: {
    key: "B",
    name: "Visualiza E0 e não responde",
    expectation: "Uma visualização não troca o fluxo: E0 → E1 → E3 → E4 → E12.",
    expectedSteps: ["E0", "E1", "E3", "E4", "E12"],
    expectedStates: ["COMPLETED"],
  },
  C: {
    key: "C",
    name: "Visualiza E0 e E1 e não responde",
    expectation: "Visualização repetida migra para o fluxo 2: E0 → E1 → V3 → V4.",
    expectedSteps: ["E0", "E1", "V3", "V4"],
    expectedStates: ["COMPLETED"],
  },
  D: {
    key: "D",
    name: "Responde E0 e desaparece",
    expectation: "Resposta interrompe a cadência; depois R1 → R2 → R3.",
    expectedSteps: ["E0", "R1", "R2", "R3"],
    expectedStates: ["COMPLETED"],
  },
  E: {
    key: "E",
    name: "Responde E1 e desaparece",
    expectation: "E0 → E1 → resposta → R1 → R2 → R3. E3 nunca é enviada.",
    expectedSteps: ["E0", "E1", "R1", "R2", "R3"],
    expectedStates: ["COMPLETED"],
  },
  F: {
    key: "F",
    name: "Responde, Executivo responde, investidor desaparece",
    expectation: "Conversa iniciada e abandonada: R1 → R2 → R3.",
    expectedSteps: ["E0", "R1", "R2", "R3"],
    expectedStates: ["COMPLETED"],
  },
  G: {
    key: "G",
    name: "Responde, desaparece e responde novamente após R1",
    expectation: "Nova resposta reinicia a espera; segue R2 → R3.",
    expectedSteps: ["E0", "R1", "R2", "R3"],
    expectedStates: ["COMPLETED"],
  },
  H: {
    key: "H",
    name: "Responde e entra em agendamento",
    expectation: "Agendamento bloqueia integralmente a cadência automática.",
    expectedSteps: ["E0"],
    expectedStates: ["SCHEDULED"],
  },
  I: {
    key: "I",
    name: "Visualiza duas vezes e não responde",
    expectation: "Fluxo de visualização repetida: E0 → E1 → V3 → V4.",
    expectedSteps: ["E0", "E1", "V3", "V4"],
    expectedStates: ["COMPLETED"],
  },
  J: {
    key: "J",
    name: "Nunca visualiza até o encerramento",
    expectation: "E0 → E1 → E3 → E4 → E12 sem nenhuma visualização.",
    expectedSteps: ["E0", "E1", "E3", "E4", "E12"],
    expectedStates: ["COMPLETED"],
  },
};

/* ------------------------------------------------------------------ */
/* Leads fictícios                                                     */
/* ------------------------------------------------------------------ */
export type NameVariant = "comum" | "minusculas" | "maiusculas" | "invalido" | "texto";

export type SimulatedLead = {
  leadId: string;
  /** Nome exibido — sempre identificável como teste (§31). */
  displayName: string;
  /** Valor bruto "recebido no cadastro" — nunca confiável de saída (§11). */
  rawName: string;
  nameVariant: NameVariant;
  scenario: ScenarioKey;
  entryAt: string;
  /** Rótulo do momento de entrada: sexta manhã, sábado, domingo etc. */
  entryLabel: string;
  /** Lead usado para forçar duplicidade/retry/worker concorrente (§46). */
  duplicityProbe: boolean;
  /** Lead usado para responder com etapa já na fila (§48). */
  raceProbe: boolean;
};

const NAME_BASES = [
  ["MARIA", "Maria Souza", "comum"],
  ["JOAO", "joão pereira", "minusculas"],
  ["CARLOS", "CARLOS LIMA", "maiusculas"],
  ["LEAD", "lead whatsapp", "invalido"],
  ["TEXTO", "quero saber mais sobre a franquia", "texto"],
] as const;

/** Distribuição mínima exigida pelo §30. */
export const SCENARIO_DISTRIBUTION: Array<{ scenario: ScenarioKey; count: number }> = [
  { scenario: "A", count: 30 },
  { scenario: "J", count: 20 },
  { scenario: "B", count: 50 },
  { scenario: "C", count: 30 },
  { scenario: "I", count: 20 },
  { scenario: "D", count: 25 },
  { scenario: "E", count: 15 },
  { scenario: "F", count: 10 },
  { scenario: "H", count: 50 },
  { scenario: "G", count: 50 },
];

/**
 * Entradas distribuídas: manhã, tarde, noite, sexta, sábado, domingo e
 * segunda-feira (§27, §28). As datas-base são fixas para tornar a
 * verificação de dia útil auditável.
 */
const ENTRY_SLOTS: Array<{ label: string; iso: string }> = [
  { label: "quinta-feira manhã", iso: "2026-08-13T12:10:00.000Z" },
  { label: "quinta-feira tarde", iso: "2026-08-13T18:40:00.000Z" },
  { label: "sexta-feira manhã", iso: "2026-08-14T11:20:00.000Z" },
  { label: "sexta-feira tarde", iso: "2026-08-14T19:05:00.000Z" },
  { label: "sexta-feira noite", iso: "2026-08-14T23:30:00.000Z" },
  { label: "sábado", iso: "2026-08-15T14:45:00.000Z" },
  { label: "domingo", iso: "2026-08-16T21:15:00.000Z" },
  { label: "segunda-feira manhã", iso: "2026-08-17T11:05:00.000Z" },
  { label: "segunda-feira noite", iso: "2026-08-17T23:50:00.000Z" },
  { label: "terça-feira tarde", iso: "2026-08-18T17:30:00.000Z" },
];

export function buildSimulatedLeads(total = 300): SimulatedLead[] {
  const leads: SimulatedLead[] = [];
  const planned = SCENARIO_DISTRIBUTION.reduce((sum, s) => sum + s.count, 0);
  const factor = total / planned;
  let seq = 0;

  for (const entry of SCENARIO_DISTRIBUTION) {
    const count = Math.max(1, Math.round(entry.count * factor));
    for (let i = 0; i < count && leads.length < total; i += 1) {
      seq += 1;
      const base = NAME_BASES[seq % NAME_BASES.length]!;
      const slot = ENTRY_SLOTS[seq % ENTRY_SLOTS.length]!;
      const code = String(seq).padStart(3, "0");
      leads.push({
        leadId: `TEST-${code}`,
        displayName: `TESTE-${base[0]}-${code}`,
        rawName: base[1],
        nameVariant: base[2] as NameVariant,
        scenario: entry.scenario,
        entryAt: slot.iso,
        entryLabel: slot.label,
        duplicityProbe: seq % 5 === 0,
        raceProbe: seq % 7 === 0,
      });
    }
  }
  return leads;
}

/**
 * Expectativa efetiva do lead. O teste de "resposta durante a fila"
 * (§48) antecipa a resposta e, por definição, cancela a etapa que
 * estava programada — o esperado muda junto, sem mascarar nada.
 */
export function expectedStepsFor(lead: SimulatedLead): CadenceStep[] {
  const base = SCENARIOS[lead.scenario].expectedSteps;
  if (lead.raceProbe && lead.scenario === "E") return ["E0", "R1", "R2", "R3"];
  return base;
}

/* ------------------------------------------------------------------ */
/* Repositório em memória da rodada                                    */
/* ------------------------------------------------------------------ */
export function createMemoryRepository(input: {
  runId: string;
}): EngineRepository & { decisions: EngineDecision[]; events: EngineEvent[] } {
  const records = new Map<string, CadenceRecord>();
  const queue = new Map<string, QueueItem>();
  const seenEvents = new Set<string>();
  const decisions: EngineDecision[] = [];
  const events: EngineEvent[] = [];
  let counter = 0;

  return {
    scope: "homologation",
    runId: input.runId,
    decisions,
    events,

    async loadRecord(leadId) {
      return records.get(leadId) ?? null;
    },
    async saveRecord(record) {
      if (record.scope !== "homologation" || record.runId !== input.runId) {
        throw new Error("Registro fora do escopo/rodada da homologação.");
      }
      records.set(record.leadId, record);
    },
    async registerEvent(event) {
      if (event.scope !== "homologation") {
        throw new Error("Evento fora do escopo de homologação.");
      }
      if (seenEvents.has(event.id)) return false;
      seenEvents.add(event.id);
      events.push(event);
      return true;
    },
    async loadQueue(leadId) {
      return [...queue.values()].filter((q) => q.leadId === leadId);
    },
    async upsertQueueItem(item) {
      const existing =
        (item.id && queue.get(item.id)) ||
        [...queue.values()].find((q) => q.leadId === item.leadId && q.step === item.step);
      counter += 1;
      const id = existing?.id ?? `q${counter}`;
      const next: QueueItem = { ...(item as QueueItem), id };
      queue.set(id, next);
      return next;
    },
    async claimQueueItem(id) {
      const item = queue.get(id);
      if (!item || item.status !== "PENDING") return false;
      queue.set(id, { ...item, status: "PROCESSING" });
      return true;
    },
    async updateQueueItem(id, patch) {
      const item = queue.get(id);
      if (item) queue.set(id, { ...item, ...patch });
    },
    async cancelPendingItems(leadId, reason) {
      let n = 0;
      for (const [id, item] of queue) {
        if (item.leadId === leadId && (item.status === "PENDING" || item.status === "PROCESSING")) {
          queue.set(id, { ...item, status: "CANCELLED", reason });
          n += 1;
        }
      }
      return n;
    },
    async recordDecision(decision) {
      decisions.push(decision);
    },
    async loadTemplates() {
      // CAMADA A (Meta) não participa da homologação: o simulador usa a
      // CAMADA B. Nenhum ID oficial fictício é criado.
      return { bindings: [] };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Execução                                                            */
/* ------------------------------------------------------------------ */
export type SimMessage = {
  leadId: string;
  direction: "outbound" | "inbound" | "system";
  step: CadenceStep | null;
  body: string;
  contentId: string | null;
  contentName: string | null;
  at: string;
  /** Botão do template (URL nunca aparece no corpo da mensagem). */
  button?: { label: string; url: string } | null;
};

export type LeadJourneyEntry = { at: string; event: string; detail: string };

export type LeadResult = {
  lead: SimulatedLead;
  executedSteps: CadenceStep[];
  finalState: CadenceState;
  finalFlow: string;
  reads: number;
  responses: number;
  scheduled: boolean;
  nameConfirmed: boolean;
  contentsUsed: string[];
  blockedDecisions: number;
  duplicatesAvoided: number;
  cancelledTasks: number;
  errors: string[];
  journey: LeadJourneyEntry[];
  messages: SimMessage[];
  decisions: EngineDecision[];
  events: EngineEvent[];
  result: "PASS" | "FAIL";
  divergence: string | null;
  expectedSteps: CadenceStep[];
  expectedStates: CadenceState[];
};

export type SimulationOptions = {
  runId: string;
  leads: SimulatedLead[];
  executiveName: string;
  portalLink: string;
  config?: RelationshipConfig;
  seed?: number;
};

export type SimulationOutput = {
  runId: string;
  /** Semente efetiva da rodada (§10 — sorteada quando não informada). */
  seed: number;
  leadResults: LeadResult[];
  decisions: EngineDecision[];
  events: EngineEvent[];
  messages: SimMessage[];
  contentUsage: Record<string, number>;
  outsideBusinessHours: SimMessage[];
};

const MINUTE = 60_000;

/** Executa a jornada completa de um único lead fictício. */
async function runLead(
  lead: SimulatedLead,
  ctx: {
    runId: string;
    executiveName: string;
    portalLink: string;
    config: RelationshipConfig;
    random: () => number;
  },
): Promise<LeadResult> {
  const scenario = SCENARIOS[lead.scenario];
  const repository = createMemoryRepository({ runId: ctx.runId });
  const messages: SimMessage[] = [];
  const journey: LeadJourneyEntry[] = [];
  const errors: string[] = [];
  const contentsUsed: string[] = [];
  let duplicatesAvoided = 0;
  let cancelledTasks = 0;
  let nameConfirmed = false;
  let now = lead.entryAt;

  const clock = { kind: "virtual" as const, now: () => new Date(now), nowIso: () => now };

  const dispatcher: EngineDispatcher = {
    scope: "homologation",
    // Trava de ambiente (§56): fora do padrão fictício, nada sai.
    async assertRecipientAllowed(leadId) {
      if (!leadId.startsWith(HOMOLOGATION_PREFIX)) {
        return { ok: false, reason: "Destinatário não pertence à homologação — envio bloqueado." };
      }
      return { ok: true };
    },
    async send(request) {
      const content = null as SimContent | null;
      const rendered = renderHomologationMessage(request.step as CadenceStep, {
        executiveName: ctx.executiveName,
        portalLink: ctx.portalLink,
        confirmedInvestorName: nameConfirmed ? normalizeName(lead.rawName).split(" ")[0] : null,
        rawInvestorName: lead.rawName,
        // Homologação: link fictício estável. Nunca sai para a Meta.
        fallbackContentUrl: "https://exemplo.invalido/homologacao/conteudo",
        fallbackContentLabel: "Conteúdo de homologação",
      });
      if (!rendered.ok) return { delivered: false, error: rendered.reason };
      if (content) {
        content.usageCount += 1;
        contentsUsed.push(content.name);
      }
      messages.push({
        leadId: lead.leadId,
        direction: "outbound",
        step: request.step as CadenceStep,
        body: rendered.body,
        contentId: content?.id ?? null,
        contentName: content?.name ?? null,
        at: now,
        button: rendered.button,
      });
      journey.push({
        at: now,
        event: `Mensagem ${request.step} enviada`,
        detail: content ? `Conteúdo anexado: ${content.name}` : "Sem conteúdo anexado.",
      });
      return { delivered: true, externalId: `sim-${lead.leadId}-${request.step}` };
    },
  };

  const engine = createEngine({
    repository,
    dispatcher,
    clock,
    config: ctx.config,
    enabled: true,
    random: ctx.random,
    // §27 — homologação usa template VIRTUAL: nada é enviado à Meta e
    // nenhuma etapa é bloqueada por ausência de template oficial.
    virtualTemplates: true,
  });

  const emit = async (
    type: EngineEvent["type"],
    suffix: string,
    extra: Partial<EngineEvent> = {},
  ) => {
    const event: EngineEvent = {
      id: `${ctx.runId}:${lead.leadId}:${suffix}`,
      scope: "homologation",
      leadId: lead.leadId,
      type,
      at: now,
      ...extra,
    };
    return engine.handleEvent(event);
  };

  const inbound = (body: string) => {
    messages.push({
      leadId: lead.leadId,
      direction: "inbound",
      step: null,
      body,
      contentId: null,
      contentName: null,
      at: now,
    });
  };

  journey.push({
    at: now,
    event: "Entrada do lead fictício",
    detail: `${lead.displayName} — ${lead.entryLabel} (cenário ${scenario.key}).`,
  });
  await emit("LEAD_CREATED", "created");

  // Entrada no motor: automática (lead chegou) ou manual (Executivo
  // iniciou o primeiro contato). Nos dois casos é o MESMO motor e a
  // MESMA cadência — nunca uma segunda cadência (§36).
  const startedBy: "automatic" | "manual" = lead.duplicityProbe ? "manual" : "automatic";
  await repository.saveRecord({
    ...initialRecord({
      scope: "homologation",
      leadId: lead.leadId,
      runId: ctx.runId,
      at: now,
    }),
    state: "CADENCE_ACTIVE",
    startedAt: now,
    startedBy,
  });

  // §46 — reprocessamento do mesmo evento não pode duplicar efeito.
  if (lead.duplicityProbe) {
    const repeated = await emit("LEAD_CREATED", "created");
    if (repeated.outcome === "noop") duplicatesAvoided += 1;
    else errors.push("Reprocessamento do evento inicial produziu efeito duplicado.");
  }

  let sends = 0;
  let raceApplied = false;
  let secondReplyApplied = false;
  let idleAdvances = 0;

  for (let iteration = 0; iteration < 60; iteration += 1) {
    const record = (await repository.loadRecord(lead.leadId)) ??
      initialRecord({ scope: "homologation", leadId: lead.leadId, runId: ctx.runId, at: now });

    void record;
    let decision: EngineDecision;
    if (lead.duplicityProbe && sends > 0) {
      // §46 — dois "workers" disputando a mesma tarefa.
      const [first, second] = await Promise.all([
        engine.tick(lead.leadId),
        engine.tick(lead.leadId),
      ]);
      const sent = [first, second].filter((d) => d.outcome === "sent");
      if (sent.length > 1) errors.push("Execução concorrente produziu mensagem duplicada.");
      else if (sent.length === 1) duplicatesAvoided += 1;
      decision = sent[0] ?? first;
    } else {
      decision = await engine.tick(lead.leadId);
    }

    if (decision.outcome === "failed") {
      errors.push(decision.error ?? decision.reason);
      break;
    }

    if (decision.outcome === "scheduled") {
      const pending = (await repository.loadQueue(lead.leadId)).find(
        (q) => q.status === "PENDING" && q.step === decision.step,
      );
      if (!pending) break;

      // §48 — resposta chega ANTES da execução de uma etapa já elegível.
      // Só provocamos a corrida em cenários que já preveem resposta do
      // investidor: assim o teste de §48 não distorce o cenário.
      const raceEligible = ["D", "E", "F", "G"].includes(lead.scenario);
      if (lead.raceProbe && raceEligible && !raceApplied && sends > 0) {
        raceApplied = true;
        now = new Date(new Date(now).getTime() + 30 * MINUTE).toISOString();
        inbound("[SIMULAÇÃO] Resposta do investidor fictício antes da etapa programada.");
        await emit("MESSAGE_RECEIVED", "race-reply");
        const stillPending = (await repository.loadQueue(lead.leadId)).find(
          (q) => q.id === pending.id && q.status === "CANCELLED",
        );
        if (stillPending) cancelledTasks += 1;
        else errors.push("Tarefa obsoleta não foi cancelada após a resposta do investidor.");
        journey.push({
          at: now,
          event: "Resposta durante fila",
          detail: `Etapa ${pending.step} cancelada antes da execução.`,
        });
        continue;
      }

      now = pending.dueAt > now ? pending.dueAt : now;
      continue;
    }

    if (decision.outcome !== "sent") {
      // O motor pode ter apenas confirmado uma etapa já programada
      // (por exemplo depois de uma visualização ou resposta): nesse caso
      // o tempo avança até o vencimento em vez de encerrar a jornada.
      const pending = (await repository.loadQueue(lead.leadId)).find(
        (q) => q.status === "PENDING",
      );
      if (pending) {
        now = pending.dueAt > now ? pending.dueAt : now;
        continue;
      }
      // Silêncio produtivo: o motor está apenas esperando o prazo do
      // fluxo (ex.: o Executivo conduzindo após uma resposta). O relógio
      // virtual avança um dia e o motor é consultado outra vez.
      const record2 = await repository.loadRecord(lead.leadId);
      const waiting =
        record2 &&
        !["COMPLETED", "CLOSED", "SCHEDULED", "INTERRUPTED", "PAUSED"].includes(record2.state) &&
        !record2.scheduled;
      if (waiting && idleAdvances < 25) {
        idleAdvances += 1;
        now = nextEligibleMoment(
          new Date(new Date(now).getTime() + 24 * 60 * MINUTE).toISOString(),
          ctx.config,
        );
        continue;
      }
      journey.push({
        at: now,
        event: "Motor não executou etapa",
        detail: decision.reason,
      });
      break;
    }

    sends += 1;
    const step = decision.step as CadenceStep;

    // ---------- LADO DO INVESTIDOR FICTÍCIO ----------
    const advance = (minutes: number) => {
      now = new Date(new Date(now).getTime() + minutes * MINUTE).toISOString();
    };

    const reads = (await repository.loadRecord(lead.leadId))?.readCount ?? 0;
    const scenarioKey = lead.scenario;

    const shouldRead =
      (scenarioKey === "B" && step === "E0") ||
      ((scenarioKey === "C" || scenarioKey === "I") && (step === "E0" || step === "E1"));
    const shouldReply =
      ((scenarioKey === "D" || scenarioKey === "F" || scenarioKey === "G" || scenarioKey === "H") &&
        step === "E0") ||
      (scenarioKey === "E" && step === "E1");

    if (shouldRead) {
      advance(25);
      await emit("MESSAGE_READ", `read-${step}`);
      journey.push({ at: now, event: "Visualização", detail: `${step} visualizada sem resposta.` });
    }

    if (shouldReply) {
      advance(35);
      inbound("[SIMULAÇÃO] Tenho interesse, me explique melhor.");
      await emit("MESSAGE_RECEIVED", `reply-${step}`);
      journey.push({ at: now, event: "Resposta do investidor", detail: `Respondeu a ${step}.` });

      // §11/§32 — o nome só passa a ser usado após confirmação explícita.
      if (isPlausibleName(lead.rawName)) {
        advance(5);
        nameConfirmed = true;
        await emit("NAME_CONFIRMED", "name", { data: { name: lead.rawName } });
        journey.push({
          at: now,
          event: "Nome confirmado",
          detail: `Executivo confirmou "${normalizeName(lead.rawName)}".`,
        });
      }

      if (scenarioKey === "F") {
        advance(20);
        await emit("EXECUTIVE_MESSAGE_SENT", "exec-reply");
        messages.push({
          leadId: lead.leadId,
          direction: "outbound",
          step: null,
          body: "[SIMULAÇÃO] Mensagem do Executivo respondendo o investidor.",
          contentId: null,
          contentName: null,
          at: now,
        });
      }

      if (scenarioKey === "H") {
        advance(45);
        await emit("SCHEDULE_CREATED", "schedule");
        journey.push({
          at: now,
          event: "Agendamento",
          detail: "Cadência automática integralmente bloqueada.",
        });
      }
      continue;
    }

    // §26 cenário G — nova resposta depois de R1.
    if (scenarioKey === "G" && step === "R1" && !secondReplyApplied) {
      secondReplyApplied = true;
      advance(40);
      inbound("[SIMULAÇÃO] Desculpe a demora, voltei a acompanhar.");
      await emit("MESSAGE_RECEIVED", "reply-r1");
      journey.push({ at: now, event: "Nova resposta", detail: "Investidor voltou após R1." });
      continue;
    }

    void reads;
    advance(10);
  }

  const finalRecord =
    (await repository.loadRecord(lead.leadId)) ??
    initialRecord({ scope: "homologation", leadId: lead.leadId, runId: ctx.runId, at: now });

  const executedSteps = finalRecord.executedSteps;
  const blockedDecisions = repository.decisions.filter((d) => d.outcome === "blocked").length;

  const expectedSteps = expectedStepsFor(lead);
  const stepsMatch =
    executedSteps.length === expectedSteps.length &&
    executedSteps.every((s, i) => s === expectedSteps[i]);
  const stateMatch = scenario.expectedStates.includes(finalRecord.state);

  const outsideHours = messages.filter(
    (m) => m.direction === "outbound" && m.step && !isEligibleMoment(m.at, ctx.config),
  );

  const problems: string[] = [];
  if (!stepsMatch) {
    problems.push(
      `Etapas executadas [${executedSteps.join(" → ") || "nenhuma"}] divergem do esperado [${expectedSteps.join(" → ")}].`,
    );
  }
  if (!stateMatch) {
    problems.push(
      `Estado final "${finalRecord.state}" fora do esperado (${scenario.expectedStates.join(", ")}).`,
    );
  }
  if (outsideHours.length > 0) {
    problems.push(
      `${outsideHours.length} mensagem(ns) fora de dia útil/horário operacional: ${outsideHours
        .map((m) => `${m.step} em ${operationalDate(m.at)}`)
        .join(", ")}.`,
    );
  }
  problems.push(...errors);

  return {
    lead,
    executedSteps,
    finalState: finalRecord.state,
    finalFlow: finalRecord.flow,
    reads: finalRecord.readCount,
    responses: finalRecord.responseCount,
    scheduled: finalRecord.scheduled,
    nameConfirmed: finalRecord.nameConfirmed,
    contentsUsed,
    blockedDecisions,
    duplicatesAvoided,
    cancelledTasks,
    errors,
    journey,
    messages,
    decisions: repository.decisions,
    events: repository.events,
    result: problems.length === 0 ? "PASS" : "FAIL",
    divergence: problems.length === 0 ? null : problems.join(" "),
    expectedSteps,
    expectedStates: scenario.expectedStates,
  };
}

/**
 * Roda a simulação inteira.
 *
 * COMANDO 3C §10/§11 — a semente NÃO é fixa entre rodadas: cada execução
 * sorteia a própria semente, de modo que a escolha de conteúdo varie de
 * verdade quando o grupo tem mais de uma opção ativa. A semente efetiva
 * é devolvida no resultado: informando a mesma semente, a rodada é
 * reproduzida integralmente para auditoria.
 */
export async function runSimulation(options: SimulationOptions): Promise<SimulationOutput> {
  const config: RelationshipConfig = options.config ?? {
    ...RELATIONSHIP_CONFIG,
    enabled: true,
    // A homologação usa a CAMADA B (mensagens de teste); a exigência de
    // template oficial da Meta continua valendo integralmente em produção.
    requireOfficialTemplate: false,
  };
  const seed = options.seed ?? Math.floor(Math.random() * 0xffffffff);
  const random = seededRandom(seed);

  const leadResults: LeadResult[] = [];
  const decisions: EngineDecision[] = [];
  const events: EngineEvent[] = [];
  const messages: SimMessage[] = [];

  for (const lead of options.leads) {
    const result = await runLead(lead, {
      runId: options.runId,
      executiveName: options.executiveName,
      portalLink: options.portalLink,
      config,
      random,
    });
    leadResults.push(result);
    messages.push(...result.messages);
    decisions.push(...result.decisions);
    events.push(...result.events);
  }

  const contentUsage: Record<string, number> = {};

  return {
    runId: options.runId,
    seed,
    leadResults,
    decisions,
    events,
    messages,
    contentUsage,
    outsideBusinessHours: messages.filter(
      (m) => m.direction === "outbound" && m.step && !isEligibleMoment(m.at, config),
    ),
  };
}