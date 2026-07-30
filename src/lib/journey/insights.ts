/**
 * Journey Engine — inteligência operacional (Épico 7B).
 *
 * Score de engajamento, momento ideal para contato, padrões de
 * comportamento e resumo automático da jornada. Nada disso é exibido ao
 * investidor: é uso interno e servirá de base para a IA Comercial.
 */
import {
  MODULE_LABEL,
  getJourney,
  listJourneys,
  type JourneyModule,
  type JourneyRecord,
  type JourneyStage,
} from "./engine";

export type BehaviorPattern =
  | "leitura_rapida"
  | "retorno_frequente"
  | "abandono_recorrente"
  | "uso_intenso_ia"
  | "simulacoes_repetidas"
  | "leitura_profunda";

export const BEHAVIOR_LABEL: Record<BehaviorPattern, string> = {
  leitura_rapida: "Lê rapidamente",
  retorno_frequente: "Retorna diversas vezes",
  abandono_recorrente: "Abandona sempre no mesmo ponto",
  uso_intenso_ia: "Usa muito a IA",
  simulacoes_repetidas: "Realiza simulações repetidas",
  leitura_profunda: "Leitura atenta e demorada",
};

export type JourneySummary = {
  investorId: string;
  name: string;
  stage: JourneyStage;
  stageLabel: string;
  /** 0–100. Índice interno — nunca exibido ao investidor. */
  engagementScore: number;
  engagementLabel: "baixo" | "moderado" | "alto" | "muito alto";
  currentModule: JourneyModule;
  currentModuleLabel: string;
  percent: number;
  sessions: number;
  returns: number;
  effectiveMinutes: number;
  lastActivityAt: string;
  lastSessionAt: string | null;
  minutesSinceLastActivity: number;
  behaviors: BehaviorPattern[];
  /** Estrutura preparada para a IA Comercial — ainda sem ação automática. */
  contactReadiness: { ready: boolean; score: number; reason: string };
  autoSummary: string;
  lastSessionSummary: string | null;
};

const STAGE_LABEL: Record<JourneyStage, string> = {
  identificado: "Identificado",
  lendo: "Em leitura",
  manual_concluido: "Manual concluído",
  simulando: "Simulando potencial",
  em_contato: "Em contato comercial",
  jornada_concluida: "Jornada concluída",
};

function resolveStage(r: JourneyRecord): JourneyStage {
  if (r.counters.meetings > 0) return "jornada_concluida";
  if (r.counters.whatsapp > 0) return "em_contato";
  if (r.counters.simulations > 0) return "simulando";
  if (r.progress.percent >= 100) return "manual_concluido";
  if (r.progress.percent > 0) return "lendo";
  return "identificado";
}

function clamp(v: number, max: number): number {
  return Math.max(0, Math.min(max, v));
}

/** Score interno de engajamento (0–100). */
export function engagementScore(r: JourneyRecord): number {
  const minutes = r.effectiveMs / 60000;
  const progress = clamp((r.progress.percent / 100) * 30, 30);
  const time = clamp((minutes / 25) * 20, 20);
  const frequency = clamp(r.counters.returns * 6, 18);
  const ai = clamp(r.counters.aiQueries * 4, 12);
  const simulator = clamp(r.counters.simulations * 6, 12);
  const completion = clamp(r.progress.modulesCompleted.length * 4, 8);
  return Math.round(progress + time + frequency + ai + simulator + completion);
}

function behaviors(r: JourneyRecord): BehaviorPattern[] {
  const out: BehaviorPattern[] = [];
  const minutes = r.effectiveMs / 60000;
  const chapters = r.counters.chapters;
  if (chapters >= 3 && minutes / chapters < 0.8) out.push("leitura_rapida");
  if (chapters >= 3 && minutes / chapters > 3) out.push("leitura_profunda");
  if (r.counters.returns >= 2) out.push("retorno_frequente");
  if (r.counters.aiQueries >= 4) out.push("uso_intenso_ia");
  if (r.counters.simulations >= 2) out.push("simulacoes_repetidas");

  // Abandono recorrente: sessões distintas encerradas no mesmo capítulo.
  const lastChapters = r.sessions
    .filter((s) => s.endedAt)
    .map((s) => [...s.events].reverse().find((e) => e.module === "manual")?.detail)
    .filter(Boolean) as string[];
  if (lastChapters.length >= 2 && new Set(lastChapters).size === 1) {
    out.push("abandono_recorrente");
  }
  return out;
}

/**
 * Momento ideal para contato — apenas preparação da lógica. Nenhum
 * contato automático é executado neste épico.
 */
function readiness(r: JourneyRecord, score: number) {
  const signals: string[] = [];
  if (r.progress.percent >= 100) signals.push("concluiu o Manual");
  if (r.counters.simulations > 0) signals.push("simulou potencial de receita");
  if (r.counters.aiQueries >= 2) signals.push("levou dúvidas à IA");
  if (r.counters.returns >= 1) signals.push("retornou ao Portal");
  const ready = score >= 55 && signals.length >= 2;
  return {
    ready,
    score,
    reason: signals.length ? `Sinais de intenção: ${signals.join(", ")}.` : "Jornada em formação.",
  };
}

function autoSummary(r: JourneyRecord, stage: JourneyStage): string {
  const minutes = Math.round(r.effectiveMs / 60000);
  const parts = [
    `${r.counters.sessions} sessão(ões)`,
    `${minutes} min efetivos`,
    `${r.progress.percent}% do Manual`,
  ];
  if (r.counters.simulations) parts.push(`${r.counters.simulations} simulação(ões)`);
  if (r.counters.aiQueries) parts.push(`${r.counters.aiQueries} pergunta(s) à IA`);
  return `${STAGE_LABEL[stage]} · ${parts.join(" · ")}.`;
}

export function summarizeJourney(record: JourneyRecord): JourneySummary {
  const stage = resolveStage(record);
  const score = engagementScore(record);
  const lastSession = record.sessions[record.sessions.length - 1] ?? null;
  const minutesSince = Math.max(
    0,
    Math.round((Date.now() - Date.parse(record.lastActivityAt)) / 60000),
  );
  return {
    investorId: record.investorId,
    name: record.name,
    stage,
    stageLabel: STAGE_LABEL[stage],
    engagementScore: score,
    engagementLabel: score >= 75 ? "muito alto" : score >= 50 ? "alto" : score >= 25 ? "moderado" : "baixo",
    currentModule: record.progress.module,
    currentModuleLabel: MODULE_LABEL[record.progress.module],
    percent: record.progress.percent,
    sessions: record.counters.sessions,
    returns: record.counters.returns,
    effectiveMinutes: Math.round(record.effectiveMs / 60000),
    lastActivityAt: record.lastActivityAt,
    lastSessionAt: lastSession?.startedAt ?? null,
    minutesSinceLastActivity: minutesSince,
    behaviors: behaviors(record),
    contactReadiness: readiness(record, score),
    autoSummary: autoSummary(record, stage),
    lastSessionSummary:
      [...record.sessions].reverse().find((s) => s.summary)?.summary ?? null,
  };
}

export function journeySummary(investorId?: string | null): JourneySummary | null {
  const record = getJourney(investorId);
  return record ? summarizeJourney(record) : null;
}

export function listJourneySummaries(): JourneySummary[] {
  return listJourneys().map(summarizeJourney);
}