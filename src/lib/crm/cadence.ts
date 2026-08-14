/**
 * Regras da cadência comercial do Portal dos Leads.
 *
 * Camada de tarefas sobre os leads já sincronizados — nunca um segundo
 * CRM. O GreenSales continua sendo a fonte da verdade das etapas; aqui
 * apenas calculamos qual atividade é devida hoje para cada lead.
 *
 * A arquitetura é multicanal desde o início: hoje existe apenas o canal
 * `call`; o canal `message` (D1→D2→D4→D5→D12→D13) pode ser ligado no
 * futuro sem alterar a mecânica.
 */
export type CadenceChannel = "call" | "message";

export const CADENCE_STEPS: Record<CadenceChannel, number[]> = {
  call: [1, 3, 4, 7],
  // A sequência de mensagens encerra no D12 — não existe D13.
  message: [1, 2, 4, 5, 12],
};

/** Etapas da origem em que o lead ainda precisa de tentativa de contato. */
export const ELIGIBLE_STAGE_KEYS = ["novos", "zero_contato", "frio"] as const;

export function isEligibleStage(stageKey: string | null): boolean {
  return Boolean(stageKey && (ELIGIBLE_STAGE_KEYS as readonly string[]).includes(stageKey));
}

const TIME_ZONE = "America/Sao_Paulo";

/** Data comercial (YYYY-MM-DD) no fuso da operação. */
export function commercialDate(value: string | Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Data de entrada real do lead na origem. Nunca usar `ingestedAt` ou
 * `lastSyncedAt` como referência da cadência — eles são técnicos.
 */
export function cadenceBaseDate(lead: {
  externalCreatedAt: string | null;
  ingestedAt?: string | null;
}): string | null {
  const source = lead.externalCreatedAt ?? lead.ingestedAt ?? null;
  if (!source) return null;
  const date = commercialDate(source);
  return date || null;
}

/** Data prevista de um passo (D1 = a própria data de entrada). */
export function dueDateForStep(baseDate: string, step: number): string {
  return addDays(baseDate, step - 1);
}

/**
 * Próximo passo aplicável considerando o histórico já executado.
 * Um lead que volta para FRIO não reinicia em D1: retomamos de onde parou.
 */
export function nextStep(
  channel: CadenceChannel,
  completedSteps: number[],
): number | null {
  const done = new Set(completedSteps);
  return CADENCE_STEPS[channel].find((step) => !done.has(step)) ?? null;
}