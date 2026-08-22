/**
 * COMANDO 2 §21–§26 — CLASSIFICAÇÃO OBJETIVA DE ENGAJAMENTO.
 *
 * Score único da plataforma, sem IA e sem arbitrariedade. Toda a
 * pontuação vem de fatos verificáveis já registrados no servidor:
 * sessões distintas, retornos, tempo ativo real, amplitude de módulos
 * e recência do último acesso.
 *
 * Regras oficiais desta versão:
 *  • tempo ativo conta no máximo 30 minutos (teto) — ficar com a aba
 *    aberta nunca vira engajamento;
 *  • eventos da MESMA sessão não geram retorno: retorno é sessão nova
 *    (o servidor só abre sessão após 2 horas sem eventos);
 *  • amplitude considera os módulos comerciais do Portal;
 *  • recência derruba a pontuação de quem sumiu — engajamento é atual.
 */
export type EngagementRecord = {
  investorId: string;
  sessions: number;
  returns: number;
  activeMs: number;
  modules: Record<string, string>;
  firstAccessAt: string;
  lastAccessAt: string;
};

/** Cinco níveis — leitura comercial imediata, sem interpretação. */
export type EngagementLevel = "muito_alto" | "alto" | "moderado" | "baixo" | "inicial";

export const ENGAGEMENT_LEVEL_LABEL: Record<EngagementLevel, string> = {
  muito_alto: "Engajamento muito alto",
  alto: "Alto engajamento",
  moderado: "Engajamento moderado",
  baixo: "Baixo engajamento",
  inicial: "Contato inicial",
};

export const MODULE_LABEL: Record<string, string> = {
  manual: "Manual",
  material: "Material",
  simulador: "Calculadora",
  revista: "Revista",
  ia: "IA do Portal",
  portal: "Portal",
  estrutura: "Nossa Estrutura",
  principios: "Princípios",
};

/** Módulos considerados no ranking (o "Portal" é o acesso base). */
export const RANKED_MODULES = ["manual", "material", "simulador", "revista"] as const;

/** Teto oficial do tempo ativo considerado na pontuação. */
export const ACTIVE_TIME_CAP_MS = 30 * 60 * 1000;

export function activeMinutes(record: EngagementRecord): number {
  return Math.round(record.activeMs / 60000);
}

/** Minutos efetivamente pontuados (respeitando o teto de 30 minutos). */
export function scoredMinutes(record: EngagementRecord): number {
  return Math.round(Math.min(record.activeMs, ACTIVE_TIME_CAP_MS) / 60000);
}

export function moduleCount(record: EngagementRecord): number {
  return RANKED_MODULES.filter((m) => Boolean(record.modules[m])).length;
}

export function daysSinceLastAccess(record: EngagementRecord): number {
  const days = (Date.now() - Date.parse(record.lastAccessAt)) / 86_400_000;
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}

export type EngagementBreakdown = {
  /** Sessões distintas (até 6 pontuadas) — até 25. */
  sessions: number;
  /** Retornos ao Portal (até 5 pontuados) — até 20. */
  returns: number;
  /** Tempo ativo com teto de 30 minutos — até 25. */
  time: number;
  /** Amplitude: módulos comerciais distintos — até 20. */
  modules: number;
  /** Recência do último acesso — até 10. */
  recency: number;
};

/** Detalhamento auditável: a tela mostra exatamente o que somou. */
export function engagementBreakdown(record: EngagementRecord): EngagementBreakdown {
  const sessions = Math.min(Math.max(record.sessions, 0), 6) * (25 / 6);
  const returns = Math.min(Math.max(record.returns, 0), 5) * 4;
  const time = (Math.min(record.activeMs, ACTIVE_TIME_CAP_MS) / ACTIVE_TIME_CAP_MS) * 25;
  const modules = (moduleCount(record) / RANKED_MODULES.length) * 20;
  const recency = Math.max(0, 10 - daysSinceLastAccess(record) * 1.5);
  return {
    sessions: Math.round(sessions),
    returns: Math.round(returns),
    time: Math.round(time),
    modules: Math.round(modules),
    recency: Math.round(recency),
  };
}

/** Pontuação 0–100 — soma do detalhamento acima. */
export function engagementScore(record: EngagementRecord): number {
  const b = engagementBreakdown(record);
  return Math.min(100, b.sessions + b.returns + b.time + b.modules + b.recency);
}

export function engagementLevel(record: EngagementRecord): EngagementLevel {
  const score = engagementScore(record);
  if (score >= 75) return "muito_alto";
  if (score >= 55) return "alto";
  if (score >= 30) return "moderado";
  if (score >= 12) return "baixo";
  return "inicial";
}

/** Frase objetiva explicando a classificação (nunca uma opinião). */
export function engagementReason(record: EngagementRecord): string {
  const parts = [
    `${record.sessions} ${record.sessions === 1 ? "sessão" : "sessões"}`,
    `${record.returns} ${record.returns === 1 ? "retorno" : "retornos"}`,
    `${scoredMinutes(record)} min ativos`,
    `${moduleCount(record)} de ${RANKED_MODULES.length} módulos`,
  ];
  const days = Math.floor(daysSinceLastAccess(record));
  parts.push(days <= 0 ? "acesso hoje" : `último acesso há ${days} d`);
  return parts.join(" · ");
}

/** "há 12 min", "há 1 h", "há 3 d" — leitura comercial imediata. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return "—";
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function formatActiveTime(record: EngagementRecord): string {
  const minutes = activeMinutes(record);
  if (minutes < 60) return `${minutes} min ativos`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min ativos`;
}
