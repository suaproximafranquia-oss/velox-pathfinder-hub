/**
 * R JÁ CONSUMIDO? — regra PURA (Financeira /f).
 *
 * O reengajamento (R1 → R2 → R3) é consumido UMA única vez por rodada de
 * relacionamento. A pergunta correta nunca é "já existe instância R?" nem
 * "já fez E?", e sim: "este lead já CUMPRIU o R?".
 *
 * Um R apenas aberto, ou interrompido no meio, NÃO conta como consumido:
 * ele volta a ser devido quando a transição estruturada
 * COMPROMISSO → FRIOS acontecer de novo.
 */

/** Instância histórica do lead, como já persistida em `relationship_cadences`. */
export type ReengagementInstanceFact = {
  flow: string;
  active: boolean;
  closeReason: string | null;
  executedSteps: string[];
};

/** Linha da fila do lead, como já persistida em `relationship_queue`. */
export type ReengagementQueueFact = {
  flow: string | null;
  step: string;
  status: string;
};

/** Encerramentos que representam a jornada R levada até o fim. */
const COMPLETED_CLOSE_REASONS = new Set(["ciclo_finalizado", "finalizada", "r_finalizado"]);

/** Última etapa prevista da jornada R. */
export const R_FINAL_STEP = "R3";

export type ReengagementConsumption = { consumed: boolean; reason: string };

export function evaluateReengagementConsumption(input: {
  instances: ReengagementInstanceFact[];
  queue: ReengagementQueueFact[];
}): ReengagementConsumption {
  const active = input.instances.find((i) => i.flow === "reengajamento" && i.active);
  if (active) {
    return { consumed: true, reason: "Já existe um reengajamento ATIVO para este lead." };
  }

  const finalExecuted = input.queue.some(
    (row) => row.step === R_FINAL_STEP && row.status === "EXECUTED",
  );
  if (finalExecuted) {
    return {
      consumed: true,
      reason: "Jornada R concluída anteriormente (R3 executada) — não existe outro R a consumir.",
    };
  }

  const finishedInstance = input.instances.some(
    (i) =>
      i.flow === "reengajamento" &&
      !i.active &&
      (COMPLETED_CLOSE_REASONS.has(i.closeReason ?? "") ||
        i.executedSteps.includes(R_FINAL_STEP)),
  );
  if (finishedInstance) {
    return {
      consumed: true,
      reason: "Ciclo de reengajamento anterior encerrado normalmente — R já consumido.",
    };
  }

  return {
    consumed: false,
    reason: "Nenhum reengajamento cumprido no histórico — o R ainda é devido.",
  };
}
