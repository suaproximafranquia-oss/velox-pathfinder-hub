/**
 * Classificação objetiva de engajamento — sem IA e sem arbitrariedade.
 *
 * A pontuação é uma soma ponderada de fatos verificáveis: sessões,
 * retornos, tempo ativo real, módulos acessados e recência do último
 * acesso. Os mesmos dados aparecem na tela, permitindo conferir a
 * posição de qualquer investidor.
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

export type EngagementLevel = "alto" | "moderado" | "baixo";

export const ENGAGEMENT_LEVEL_LABEL: Record<EngagementLevel, string> = {
  alto: "Alto engajamento",
  moderado: "Engajamento moderado",
  baixo: "Baixo engajamento",
};

export const MODULE_LABEL: Record<string, string> = {
  manual: "Manual",
  material: "Material",
  simulador: "Calculadora",
  ia: "IA do Portal",
  portal: "Portal",
};

/** Módulos considerados no ranking (o "Portal" é o acesso base). */
export const RANKED_MODULES = ["manual", "material", "simulador"] as const;

export function activeMinutes(record: EngagementRecord): number {
  return Math.round(record.activeMs / 60000);
}

export function moduleCount(record: EngagementRecord): number {
  return RANKED_MODULES.filter((m) => Boolean(record.modules[m])).length;
}

/**
 * Pontuação 0–100. Cada componente tem teto próprio, evitando que um
 * único fator (ex.: muitas sessões curtas) domine o ranking.
 */
export function engagementScore(record: EngagementRecord): number {
  const sessions = Math.min(record.sessions, 10) * 3; // até 30
  const returns = Math.min(record.returns, 8) * 2.5; // até 20
  const minutes = Math.min(activeMinutes(record), 60) / 60 * 25; // até 25
  const modules = moduleCount(record) * 5; // até 15
  const days = (Date.now() - Date.parse(record.lastAccessAt)) / 86_400_000;
  const recency = Number.isFinite(days) ? Math.max(0, 10 - days * 1.5) : 0; // até 10
  return Math.round(sessions + returns + minutes + modules + recency);
}

export function engagementLevel(record: EngagementRecord): EngagementLevel {
  const score = engagementScore(record);
  if (score >= 55) return "alto";
  if (score >= 25) return "moderado";
  return "baixo";
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
