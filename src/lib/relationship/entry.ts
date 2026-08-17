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

/**
 * RELACIONAMENTO QUE ESFRIOU (COMANDO 3D §18).
 *
 * Lead que JÁ teve conversa real — agendamento marcado, vídeo enviado
 * ou apresentação realizada — e voltou para FRIO. Não é reentrada nem
 * primeiro contato: ele entra no fluxo RF, que reconhece o histórico.
 */
export type CooledHistory = {
  /** Etapa vigente na origem no fechamento do dia. */
  stageKey: string | null;
  /** Houve agendamento, envio de vídeo ou apresentação realizada. */
  hadRealConversation: boolean;
};

export function resolveCooledFlow(history: CooledHistory): EntryResolution | null {
  if (history.stageKey !== "frio") return null;
  if (!history.hadRealConversation) return null;
  return {
    flow: "relacionamento_frio",
    reentry: false,
    reason:
      "Relacionamento real anterior que esfriou — cadência RF0 → RF1, nunca o fluxo de primeiro contato.",
  };
}
