/**
 * ENTRADA x REENTRADA (COMANDO 2B §1).
 *
 * Regra pura: um lead que a operação já conhece e que volta a se
 * cadastrar NÃO recomeça o fluxo de primeiro contato. A simples volta
 * do lead para a coluna "NOVOS" na origem não caracteriza reentrada —
 * é preciso que exista uma nova entrada comercial sobre um histórico
 * de relacionamento anterior.
 */
import type { CadenceFlow } from "./types";

export type EntryHistory = {
  /** Quantidade de entradas comerciais registradas na origem. */
  entryCount: number;
  /** Já existiu relacionamento anterior (mensagem enviada/recebida). */
  hasPreviousRelationship: boolean;
  /** Nova entrada comercial detectada agora pela sincronização. */
  newCommercialEntry: boolean;
};

export type EntryResolution = { flow: CadenceFlow; reentry: boolean; reason: string };

export function resolveEntryFlow(history: EntryHistory): EntryResolution {
  if (!history.hasPreviousRelationship) {
    return {
      flow: "sem_resposta",
      reentry: false,
      reason: "Sem relacionamento anterior — primeira entrada, fluxo de primeiro contato.",
    };
  }
  if (!history.newCommercialEntry && history.entryCount <= 1) {
    return {
      flow: "sem_resposta",
      reentry: false,
      reason:
        "Lead conhecido sem nova entrada comercial — mudança de coluna na origem não reinicia cadência.",
    };
  }
  return {
    flow: "reentrada",
    reentry: true,
    reason: "Lead já conhecido com nova entrada comercial — cadência de reentrada (RE0 → RE3).",
  };
}
