/**
 * FECHAMENTO OPERACIONAL DO DIA (COMANDO 3D §3, §4, §25, §26).
 *
 * O motor NÃO decide porque o lead passou por uma etapa durante o dia.
 * Ele decide pelo ESTADO VIGENTE às 22:00 (America/Sao_Paulo). Se o
 * lead esteve em ZERO CONTATO às 10h e terminou o dia em OPORTUNIDADE,
 * nenhuma cadência de ZERO CONTATO é criada.
 */
import { operationalDate } from "./calendar";

/** Hora de referência do fechamento operacional (hora local). */
export const DAILY_CLOSING_HOUR = 22;

/** Etapas da origem que autorizam cadência automática (§4). */
export const AUTOMATION_ELIGIBLE_STAGES = ["zero_contato", "frio"] as const;

/**
 * Etapas terminais/neutras: nunca geram cadência automática de
 * primeira entrada. OPORTUNIDADE é terminal — o lead permanece nela
 * até decisão MANUAL do Executivo (§26).
 */
export const NON_AUTOMATED_STAGES = ["novos", "agendamento", "video", "oportunidade"] as const;
export const TERMINAL_STAGES = ["oportunidade"] as const;

export type StageTransition = { stageKey: string; at: string };

/** Instante UTC correspondente às 22:00 locais de uma data. */
export function dailyClosingMoment(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  // A operação está em UTC-3 o ano inteiro.
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, DAILY_CLOSING_HOUR + 3, 0, 0)).toISOString();
}

/**
 * Estado do lead no fechamento do dia: a última transição ocorrida ATÉ
 * as 22:00 locais. Transições posteriores pertencem ao dia seguinte.
 */
export function stageAtClosing(
  transitions: StageTransition[],
  isoDate: string,
): string | null {
  const limit = dailyClosingMoment(isoDate);
  const applicable = transitions
    .filter((t) => t.at <= limit)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return applicable.length > 0 ? applicable[applicable.length - 1]!.stageKey : null;
}

export function isAutomationEligibleStage(stageKey: string | null | undefined): boolean {
  if (!stageKey) return false;
  return (AUTOMATION_ELIGIBLE_STAGES as readonly string[]).includes(stageKey);
}

export function isTerminalStage(stageKey: string | null | undefined): boolean {
  if (!stageKey) return false;
  return (TERMINAL_STAGES as readonly string[]).includes(stageKey);
}

export type ClosingDecision = { eligible: boolean; stage: string | null; reason: string };

/**
 * Decisão oficial do fechamento: o lead entra (ou não) na jornada
 * automática do próximo dia. Sempre com motivo legível.
 */
export function evaluateDailyClosing(input: {
  transitions: StageTransition[];
  /** Data operacional avaliada (YYYY-MM-DD) ou instante ISO. */
  date: string;
}): ClosingDecision {
  const date = input.date.includes("T") ? operationalDate(input.date) : input.date;
  const stage = stageAtClosing(input.transitions, date);
  if (!stage) {
    return { eligible: false, stage: null, reason: "Sem etapa registrada até o fechamento do dia." };
  }
  if (isTerminalStage(stage)) {
    return {
      eligible: false,
      stage,
      reason:
        "Lead em OPORTUNIDADE no fechamento — etapa terminal: nenhuma cadência automática e nenhuma volta automática para FRIO.",
    };
  }
  if (!isAutomationEligibleStage(stage)) {
    return {
      eligible: false,
      stage,
      reason: `Etapa "${stage}" no fechamento não gera cadência automática — condução manual do Executivo.`,
    };
  }
  return {
    eligible: true,
    stage,
    reason: `Etapa "${stage}" vigente no fechamento de ${date} — cadência automática autorizada.`,
  };
}