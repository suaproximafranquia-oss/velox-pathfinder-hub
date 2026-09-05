/**
 * REGISTRO ÚNICO DE ETAPAS DO MOTOR.
 *
 * O motor só executa etapa que EXISTE aqui. Qualquer chave fora desta
 * lista (erro de digitação, resíduo de importação, etapa inventada por
 * um conteúdo antigo) é recusada explicitamente, com motivo legível —
 * jamais é tratada como etapa válida nem sai para o investidor.
 *
 * Etapas de cadência vêm de `STEPS` (config), fonte única das regras.
 * As etapas fora da cadência (primeiro contato, apresentação digital,
 * checkpoint, finalização e resposta automática) são declaradas aqui.
 */
import { STEPS } from "./config";

/** Etapas oficiais que não pertencem à máquina de cadência. */
export const NON_CADENCE_STEPS = [
  "E20",
  "E27",
  "FINALIZACAO",
  "RESPOSTA_AUTOMATICA",
] as const;

/** Etapas declaradas em código — base mínima, nunca a única fonte. */
export const BASE_STEP_KEYS: readonly string[] = [
  ...Object.keys(STEPS),
  ...NON_CADENCE_STEPS,
];

/**
 * Compatibilidade: continua exportado e continua contendo as etapas
 * declaradas em código.
 */
export const KNOWN_STEP_KEYS: readonly string[] = BASE_STEP_KEYS;

/**
 * BLOCO 2 — ETAPAS CONHECIDAS = BIBLIOTECA ATIVA ∪ HISTÓRICO.
 *
 * O conjunto dinâmico é carregado no servidor (ver
 * `step-registry.server.ts`) e registrado aqui. Etapas históricas
 * continuam reconhecidas mesmo quando saem da Biblioteca; etapas novas
 * da Biblioteca passam a ser reconhecidas sem alterar código.
 *
 * Nada aqui decide ORDEM ou PRAZO de fluxo — apenas responde
 * "esta chave é uma etapa reconhecida?".
 */
const dynamicStepKeys = new Set<string>();

function normalize(step: string): string {
  return step.trim().toUpperCase();
}

export function registerKnownSteps(steps: Iterable<string>): void {
  for (const step of steps) {
    const key = normalize(String(step ?? ""));
    if (key) dynamicStepKeys.add(key);
  }
}

/** Somente para testes: limpa o conjunto dinâmico registrado. */
export function resetDynamicKnownSteps(): void {
  dynamicStepKeys.clear();
}

export function knownStepKeys(): string[] {
  return [...new Set([...BASE_STEP_KEYS, ...dynamicStepKeys])];
}

/**
 * Etapas que o MOTOR anexa material. Derivadas de `STEPS` — não existe
 * segunda lista. Uma etapa daqui sem vínculo declarado não envia
 * conteúdo (e isso aparece como lacuna na Biblioteca).
 */
export const CONTENT_REQUIRED_STEPS: readonly string[] = Object.values(STEPS)
  .filter((s) => Boolean(s.contentGroup))
  .map((s) => s.step);

export function isKnownStep(step: string | null | undefined): boolean {
  if (!step) return false;
  const key = normalize(step);
  return BASE_STEP_KEYS.includes(key) || dynamicStepKeys.has(key);
}

/** Motivo padronizado do bloqueio — usado no log e na interface. */
export function unknownStepReason(step: string): string {
  return `Etapa desconhecida "${step}": não existe no motor. Nada foi enviado. Cadastre a etapa oficial ou corrija o vínculo na Biblioteca.`;
}

