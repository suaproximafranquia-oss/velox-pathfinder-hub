/**
 * RF — RELACIONAMENTO ESFRIADO (regra PURA, Financeira /f).
 *
 * O RF NÃO é continuação de E, R ou RE. Ele é a ÚLTIMA camada de
 * reaproximação, acionada somente depois que uma jornada comercial
 * normal terminou e o lead não voltou a evoluir.
 *
 *   última tentativa EFETIVA da jornada encerrada
 *     → +20 dias corridos → rechecagem → RF0
 *   execução REAL do RF0
 *     → +30 dias corridos → rechecagem → RF1 (terminal, não existe RF2)
 *
 * REGRAS FECHADAS:
 *  • a referência é a última tentativa realmente EXECUTADA (fila), nunca
 *    a entrada em FRIOS, `ended_at` ou a criação da instância;
 *  • os 30 dias do RF1 contam da execução REAL do RF0, jamais da data
 *    prevista;
 *  • qualquer evolução comercial depois da referência tira o RF da
 *    elegibilidade — o pendente é CANCELADO com motivo, nunca apagado;
 *  • RF é POR JORNADA: uma nova jornada completa dá direito a um novo
 *    RF0/RF1, sem tocar nos RFs históricos;
 *  • SEM BACKFILL: jornadas cuja última tentativa é anterior à ativação
 *    desta regra não entram no mecanismo.
 *
 * Este módulo é PURO: recebe fatos já lidos e devolve a decisão com
 * motivo legível. Nada aqui acessa banco, relógio ou rede.
 */
import { atWindowStart, localDateOf, shiftTheoreticalDate } from "./cadence-v2";

export const RF_FLOW = "relacionamento_frio";
export const RF0_STEP = "RF0";
export const RF1_STEP = "RF1";
export const RF_STEPS = [RF0_STEP, RF1_STEP] as const;
export type RfStep = (typeof RF_STEPS)[number];

/** Dias corridos entre a última tentativa efetiva e o RF0. */
export const RF0_DELAY_DAYS = 20;
/** Dias corridos entre a EXECUÇÃO REAL do RF0 e o RF1. */
export const RF1_DELAY_DAYS = 30;

/**
 * ATIVAÇÃO DA REGRA — não existe backfill. Jornadas encerradas antes
 * deste marco permanecem exatamente como estão: nenhum RF retroativo é
 * criado para histórico antigo.
 */
export const RF_ACTIVATION_AT = "2026-09-08T00:00:00.000Z";

/** Etapas comerciais que representam evolução (nunca geram RF). */
export const PROGRESSED_STAGES = [
  "agendamentos",
  "agendamento",
  "video",
  "vídeo",
  "oportunidade",
  "oportunidades",
] as const;

export function isProgressedStage(stageKey: string | null | undefined): boolean {
  if (!stageKey) return false;
  return (PROGRESSED_STAGES as readonly string[]).includes(stageKey.trim().toLowerCase());
}

export function isRfStep(step: string | null | undefined): step is RfStep {
  if (!step) return false;
  return (RF_STEPS as readonly string[]).includes(step.trim().toUpperCase());
}

/** Linha da fila do lead, como já persistida em `relationship_queue`. */
export type RfQueueFact = {
  id?: string;
  step: string;
  /** Em RF, a ordem carrega a JORNADA que originou aquele RF. */
  actionOrder: number;
  status: string;
  dueAt: string | null;
  executedAt: string | null;
};

/** Instância de jornada, como já persistida em `relationship_cadences`. */
export type RfInstanceFact = {
  instanceSeq: number;
  active: boolean;
  startedAt: string | null;
  endedAt: string | null;
};

/** Sinais de evolução comercial já reconhecidos pelo motor. */
export type RfEvolutionFacts = {
  /** Etapa comercial vigente do lead (`portal_leads.commercial_state`). */
  stageKey: string | null;
  /** Evento mais recente do lead que não seja do próprio RF. */
  latestEventAt: string | null;
  /** Compromisso (agendamento/vídeo) mais recente registrado. */
  latestMeetingAt: string | null;
};

export type RfDecision =
  | { kind: "none"; reason: string }
  | {
      kind: "schedule";
      step: RfStep;
      journeySeq: number;
      dueAt: string;
      referenceAt: string;
      reason: string;
    }
  | { kind: "cancel"; step: RfStep; journeySeq: number; reason: string };

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Vencimento operacional de um RF: dias corridos + calendário do motor. */
export function rfDueAt(referenceIso: string, days: number): string {
  const theoretical = addDays(localDateOf(referenceIso), days);
  return atWindowStart(shiftTheoreticalDate(theoretical));
}

/**
 * ÚLTIMA TENTATIVA EFETIVA da jornada encerrada: a execução mais
 * recente registrada na fila que NÃO seja do próprio RF.
 */
export function lastEffectiveAttempt(queue: RfQueueFact[]): string | null {
  const executions = queue
    .filter((row) => row.status === "EXECUTED" && row.executedAt && !isRfStep(row.step))
    .map((row) => row.executedAt as string)
    .sort();
  return executions.length > 0 ? executions[executions.length - 1]! : null;
}

/** Jornada (rodada) a que este RF pertence. Preserva RFs anteriores. */
export function journeySeqOf(instances: RfInstanceFact[]): number {
  const seqs = instances.map((i) => i.instanceSeq).filter((n) => Number.isFinite(n));
  return seqs.length > 0 ? Math.max(...seqs) : 1;
}

/** Houve QUALQUER evolução comercial depois da referência? */
export function evolutionSince(
  referenceIso: string,
  input: { queue: RfQueueFact[]; instances: RfInstanceFact[]; evolution: RfEvolutionFacts },
): string | null {
  if (isProgressedStage(input.evolution.stageKey)) {
    return `Lead está em ${input.evolution.stageKey} — jornada voltou a evoluir.`;
  }
  if (input.instances.some((i) => i.active)) {
    return "Existe jornada ativa (E, R ou RE) para este lead.";
  }
  if (input.instances.some((i) => (i.startedAt ?? "") > referenceIso)) {
    return "Nova jornada foi aberta depois da referência.";
  }
  if (
    input.queue.some(
      (row) =>
        !isRfStep(row.step) &&
        row.status === "EXECUTED" &&
        (row.executedAt ?? "") > referenceIso,
    )
  ) {
    return "Houve nova ação executada depois da referência.";
  }
  if ((input.evolution.latestEventAt ?? "") > referenceIso) {
    return "Há evento novo do investidor depois da referência.";
  }
  if ((input.evolution.latestMeetingAt ?? "") > referenceIso) {
    return "Há compromisso (agendamento/vídeo) depois da referência.";
  }
  return null;
}

function rfRow(queue: RfQueueFact[], step: RfStep, journeySeq: number): RfQueueFact | null {
  return (
    queue.find(
      (row) => row.step.trim().toUpperCase() === step && Number(row.actionOrder) === journeySeq,
    ) ?? null
  );
}

/**
 * DECISÃO OFICIAL DO RF para um lead, num instante. Sempre com motivo.
 */
export function decideColdRelationship(input: {
  nowIso: string;
  queue: RfQueueFact[];
  instances: RfInstanceFact[];
  evolution: RfEvolutionFacts;
  /** Marco de ativação — sem backfill. */
  activationAt?: string;
}): RfDecision {
  const activation = input.activationAt ?? RF_ACTIVATION_AT;
  const journeySeq = journeySeqOf(input.instances);
  const rf0 = rfRow(input.queue, RF0_STEP, journeySeq);
  const rf1 = rfRow(input.queue, RF1_STEP, journeySeq);

  // RF1 já cumprido: fim absoluto desta jornada. Não existe RF2.
  if (rf1?.status === "EXECUTED") {
    return { kind: "none", reason: "RF1 já executado nesta jornada — o RF é terminal." };
  }

  const reference =
    rf0?.status === "EXECUTED" && rf0.executedAt
      ? rf0.executedAt
      : lastEffectiveAttempt(input.queue);

  if (!reference) {
    return { kind: "none", reason: "Nenhuma tentativa efetiva registrada — não há referência." };
  }

  const evolved = evolutionSince(reference, input);

  // Evolução cancela o RF pendente desta jornada, preservando a linha.
  if (evolved) {
    const pending = [rf1, rf0].find(
      (row) => row && (row.status === "PENDING" || row.status === "PROCESSING"),
    );
    if (pending) {
      return {
        kind: "cancel",
        step: pending.step.trim().toUpperCase() as RfStep,
        journeySeq,
        reason: `RF cancelado: ${evolved}`,
      };
    }
    return { kind: "none", reason: `RF não é elegível: ${evolved}` };
  }

  // RF0 executado → RF1 conta 30 dias da EXECUÇÃO REAL.
  if (rf0?.status === "EXECUTED" && rf0.executedAt) {
    if (rf1) {
      return { kind: "none", reason: "RF1 desta jornada já está na fila." };
    }
    const dueAt = rfDueAt(rf0.executedAt, RF1_DELAY_DAYS);
    if (input.nowIso < dueAt) {
      return { kind: "none", reason: `RF1 previsto para ${localDateOf(dueAt)} — ainda não venceu.` };
    }
    return {
      kind: "schedule",
      step: RF1_STEP,
      journeySeq,
      dueAt,
      referenceAt: rf0.executedAt,
      reason: `30 dias da execução real do RF0 sem nova evolução — RF1 (última tentativa).`,
    };
  }

  if (rf0) {
    return { kind: "none", reason: `RF0 desta jornada já está na fila (${rf0.status}).` };
  }

  // Sem backfill: só jornadas encerradas a partir da ativação da regra.
  if (reference < activation) {
    return {
      kind: "none",
      reason: "Última tentativa anterior à ativação do RF — histórico preservado, sem RF retroativo.",
    };
  }

  const dueAt = rfDueAt(reference, RF0_DELAY_DAYS);
  if (input.nowIso < dueAt) {
    return { kind: "none", reason: `RF0 previsto para ${localDateOf(dueAt)} — ainda não venceu.` };
  }
  return {
    kind: "schedule",
    step: RF0_STEP,
    journeySeq,
    dueAt,
    referenceAt: reference,
    reason: "20 dias da última tentativa efetiva sem nova evolução — RF0 (retomada).",
  };
}

/** Chave determinística do evento — idempotência por jornada. */
export function rfEventKey(leadId: string, step: RfStep, journeySeq: number): string {
  return `${step.toLowerCase()}_${leadId}_j${journeySeq}`;
}
