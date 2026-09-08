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
 * CHAVES HISTÓRICAS: registros antigos que permanecem no banco apenas
 * para leitura. Nunca são identidade atual de uma etapa e jamais servem
 * de chave técnica só porque algum registro antigo as usava.
 */
export const HISTORICAL_STEP_KEYS: readonly string[] = [
  "E0_V1",
  "E12",
  "E20",
  "E27",
  "E30",
  "V3",
  "V4",
  "RF0",
  "RF1",
  "FINALIZACAO",
  "TESTE",
];

export function isHistoricalStep(step: string | null | undefined): boolean {
  if (!step) return false;
  return HISTORICAL_STEP_KEYS.includes(String(step).trim().toUpperCase());
}

/**
 * CÓDIGO EDITORIAL DE ETAPA: 1–3 letras maiúsculas + até 2 dígitos
 * (E5, R3, RE0, ER0…). É exatamente o que a Gestão digitar — nunca é
 * convertido (ER0 não vira E0, R3 não vira E3).
 */
export const STEP_CODE_PATTERN = /^[A-Z]{1,3}\d{0,2}$/;

export function isValidStepCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const key = String(code).trim().toUpperCase();
  return STEP_CODE_PATTERN.test(key) || key === AUTO_REPLY_STEP_KEY;
}

/**
 * ETAPA COM IDENTIDADE ATUAL na Biblioteca: as da régua V2 mais qualquer
 * código editorial válido definido pela Gestão que não seja chave
 * histórica. A chave técnica de uma etapa É o seu código atual.
 */
export function isCurrentEditorialStep(step: string | null | undefined): boolean {
  if (!step) return false;
  const key = String(step).trim().toUpperCase();
  if (isOperationalStep(key)) return true;
  if (isHistoricalStep(key)) return false;
  return isValidStepCode(key);
}

/** Prefixo "CÓDIGO —" no início de um rótulo (E3 —, RE1 -, ER0 -…). */
export const STEP_CODE_PREFIX = /^\s*([A-Za-z]{1,3}\d{0,2})\s*[—–-]\s*/;

/**
 * SEPARA a identidade digitada pela Gestão em CÓDIGO + TÍTULO.
 * "E5 — Apresentação Digital" → { code: "E5", title: "Apresentação Digital" }.
 * Sem prefixo de código → code null (só o título muda).
 */
export function parseStepIdentity(label: string): { code: string | null; title: string } {
  const match = STEP_CODE_PREFIX.exec(label ?? "");
  if (!match) return { code: null, title: (label ?? "").trim() };
  return {
    code: match[1]!.toUpperCase(),
    title: (label ?? "").slice(match[0].length).trim(),
  };
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
