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

export const KNOWN_STEP_KEYS: readonly string[] = [
  ...Object.keys(STEPS),
  ...NON_CADENCE_STEPS,
];

export function isKnownStep(step: string | null | undefined): boolean {
  if (!step) return false;
  return KNOWN_STEP_KEYS.includes(step.trim().toUpperCase());
}

/** Motivo padronizado do bloqueio — usado no log e na interface. */
export function unknownStepReason(step: string): string {
  return `Etapa desconhecida "${step}": não existe no motor. Nada foi enviado. Cadastre a etapa oficial ou corrija o vínculo na Biblioteca.`;
}
