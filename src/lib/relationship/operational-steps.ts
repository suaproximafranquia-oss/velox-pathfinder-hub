/**
 * IDENTIDADE OPERACIONAL ATUAL DAS ETAPAS (Financeira /f).
 *
 * Fonte única do que é "etapa atual" para a Biblioteca de Mensagens do
 * Motor: a régua V2 (`CADENCE_V2_STEPS`) mais a resposta automática da
 * janela de 24h. Chaves históricas (E12, E20, E27, FINALIZACAO, RF0,
 * RF1, V3, V4, E0_V1, E30…) continuam gravadas no banco, na fila e nos
 * snapshots para auditoria, mas NÃO são identidade editorial de nenhuma
 * etapa atual e não aparecem na lista operacional.
 *
 * Nada aqui decide ordem, prazo ou fluxo — isso é `cadence-v2`.
 */
import { CADENCE_V2_STEPS } from "./cadence-v2";

/** Etapa própria da orientação automática dentro da janela de 24h. */
export const AUTO_REPLY_STEP_KEY = "RESPOSTA_AUTOMATICA";

export const OPERATIONAL_STEP_KEYS: readonly string[] = [
  ...CADENCE_V2_STEPS,
  AUTO_REPLY_STEP_KEY,
];

/** Únicas etapas com eixo de contexto. Nenhuma outra recebe contexto. */
export const CONTEXTUAL_STEP_KEYS: readonly string[] = ["E7", "E8"];

export const STEP_CONTEXTS = ["SEM_CONTATO", "MATERIAL_ENVIADO"] as const;
export type StepContext = (typeof STEP_CONTEXTS)[number];

export function isOperationalStep(step: string | null | undefined): boolean {
  if (!step) return false;
  return OPERATIONAL_STEP_KEYS.includes(String(step).trim().toUpperCase());
}

export function isContextualStep(step: string | null | undefined): boolean {
  if (!step) return false;
  return CONTEXTUAL_STEP_KEYS.includes(String(step).trim().toUpperCase());
}

/**
 * Combinações operacionais de uma etapa (uma versão ativa por combinação):
 * E7/E8 → [SEM_CONTATO, MATERIAL_ENVIADO]; demais → [null].
 */
export function stepCombinations(step: string): Array<StepContext | null> {
  return isContextualStep(step) ? [...STEP_CONTEXTS] : [null];
}

/**
 * MAPA HISTÓRICO → IDENTIDADE ATUAL. Usado SOMENTE para apresentar
 * registros antigos (histórico de envios, jornada) com a nomenclatura de
 * hoje. Nunca é usado para buscar mensagem nem para gravar nada.
 */
export const HISTORICAL_STEP_TO_CURRENT: Readonly<Record<string, string>> = {
  E12: "E3",
  E20: "E6",
  E27: "E7",
};
