/**
 * DECISÃO OPERACIONAL DA RÉGUA V2 — módulo PURO da Financeira /f.
 *
 * Esta é a ÚNICA função que diz qual é a próxima obrigação de um ciclo
 * governado pela nova régua. Ela não conhece banco, rede nem interface:
 * recebe o estado persistido (fila + ciclo + contexto estruturado) e
 * devolve uma decisão. `decide.ts` delega para cá — não existe segundo
 * motor, segundo tick nem gerador paralelo.
 *
 * Regras aplicadas aqui (todas já fechadas com a gestão):
 *   • E0 → E1 → E2 → E3 → E4 → E7 → E8; ramo material E4 → E5 → E6 → E7 → E8;
 *   • data teórica a partir da ORIGEM do ciclo, execução anterior como piso;
 *   • dias corridos, sábado/domingo/feriado deslocam o vencimento teórico;
 *   • ligação sempre antes de mensagem, dentro da mesma etapa;
 *   • AGENDAMENTO congela; ligação atendida sem encaminhamento suspende.
 */
import {
  flowOfStep,
  isCadenceFrozen,
  localDateOf,
  nextReleasedAction,
  nextTransition,
  planDue,
  stepActions,
  type ActionState,
  type CadenceV2Flow,
  type CadenceV2Step,
  type CycleContext,
  type StepActionKind,
} from "./cadence-v2";

/** Primeira etapa de cada fluxo. E0 nasce na entrada, não aqui. */
export const V2_FLOW_ENTRY: Record<CadenceV2Flow, CadenceV2Step> = {
  E: "E0",
  R: "R1",
  RE: "RE0",
};

/** Motivos de cancelamento — vocabulário fechado e auditável. */
export const V2_CANCEL_REASONS = {
  attended: "contact_attended",
  flowChanged: "flow_changed",
  scheduled: "scheduled",
} as const;

export type V2CancelReason = (typeof V2_CANCEL_REASONS)[keyof typeof V2_CANCEL_REASONS];

/** Linha da fila, já normalizada para o planejador. */
export type V2QueueAction = {
  step: string;
  actionOrder: number;
  actionKind: StepActionKind;
  status: string;
  dueAt: string;
  executedAt: string | null;
  /** Resultado da ligação: "SIM" (atendeu) ou "NAO". */
  result: string | null;
};

export type V2DecisionInput = {
  nowIso: string;
  flow: CadenceV2Flow;
  /** D0 do ciclo (YYYY-MM-DD, hora local da operação). */
  originDate: string;
  /** Todas as linhas da fila do ciclo, de qualquer status. */
  actions: V2QueueAction[];
  /** Etapas já executadas fora da fila (histórico do ciclo, ex.: E0). */
  executedSteps: string[];
  cycle: CycleContext;
  stageKey: string | null;
  /** Ligação atendida sem encaminhamento registrado. */
  awaitingHandoff: boolean;
  /** Ciclo encerrado/interrompido — nenhuma obrigação nova. */
  closed?: boolean;
  /** Momento em que o lead aceitou receber a apresentação (ancora E5). */
  materialRequestedAt?: string | null;
};

export type V2Obligation = {
  kind: "obligation";
  step: CadenceV2Step;
  actionOrder: number;
  actionKind: StepActionKind;
  label: string;
  dueAt: string;
  theoreticalDate: string;
  originDate: string;
  reason: string;
};

export type V2Decision = { kind: "none"; reason: string } | V2Obligation;

function toActionState(rows: V2QueueAction[]): ActionState[] {
  return rows.map((row) => ({
    order: row.actionOrder,
    status:
      row.status === "EXECUTED"
        ? "DONE"
        : row.status === "CANCELLED"
          ? "CANCELLED"
          : "PENDING",
    executedAt: row.executedAt ?? null,
  }));
}

/** A etapa terminou (todas as ações concluídas ou canceladas)? */
function stepFinished(step: CadenceV2Step, rows: V2QueueAction[]): boolean {
  const plan = stepActions(step);
  if (rows.length === 0) return false;
  const byOrder = new Map(rows.map((r) => [r.actionOrder, r]));
  // Ligação atendida encerra a etapa: as ações restantes perderam finalidade.
  const attended = rows.some(
    (r) => r.actionKind === "call" && r.status === "EXECUTED" && r.result === "SIM",
  );
  if (attended) return true;
  return plan.every((a) => {
    const row = byOrder.get(a.order);
    return row?.status === "EXECUTED" || row?.status === "CANCELLED";
  });
}

function lastExecution(rows: V2QueueAction[]): string | null {
  const executed = rows
    .filter((r) => r.status === "EXECUTED" && r.executedAt)
    .map((r) => r.executedAt as string)
    .sort();
  return executed.length ? executed[executed.length - 1]! : null;
}

/**
 * Única porta de decisão da régua V2.
 */
export function decideCadenceV2(input: V2DecisionInput): V2Decision {
  if (input.closed) {
    return { kind: "none", reason: "Ciclo encerrado — nenhuma obrigação nova é criada." };
  }
  if (isCadenceFrozen({ stageKey: input.stageKey, hasCommitment: input.hasCommitment })) {
    return {
      kind: "none",
      reason: "Compromisso real (AGENDAMENTOS/VÍDEO com follow_up) — a cadência fica congelada até a decisão humana.",
    };
  }
  /**
   * `awaitingHandoff` NÃO congela mais: atender uma ligação não é
   * compromisso. O campo permanece apenas como histórico dos ciclos
   * anteriores.
   */

  const byStep = new Map<string, V2QueueAction[]>();
  for (const action of input.actions) {
    const list = byStep.get(action.step) ?? [];
    list.push(action);
    byStep.set(action.step, list);
  }

  const executedElsewhere = new Set(input.executedSteps);
  const used: string[] = [];

  let step: CadenceV2Step = V2_FLOW_ENTRY[input.flow];
  let anchorDate = input.originDate;
  let offset = 0;
  let previousExecution: string | null = null;

  for (let guard = 0; guard < 32; guard += 1) {
    const rows = byStep.get(step) ?? [];
    const isEntry = step === V2_FLOW_ENTRY[input.flow];

    /**
     * A etapa já aconteceu — seja pela fila, seja pelo histórico do
     * ciclo (a E0 nasce na entrada do lead, não nesta fila).
     */
    const done = stepFinished(step, rows) || (rows.length === 0 && executedElsewhere.has(step));
    if (done) {
      const executedAt = lastExecution(rows);
      if (executedAt) {
        previousExecution = executedAt;
        used.push(localDateOf(executedAt));
      }
      const transition = nextTransition(step, input.cycle);
      if (!transition) {
        return { kind: "none", reason: `Ciclo completo — ${step} é a última etapa do fluxo.` };
      }
      if (transition.immediate) {
        anchorDate = localDateOf(
          input.materialRequestedAt ?? previousExecution ?? `${anchorDate}T12:00:00.000Z`,
        );
        offset = 0;
      } else {
        offset += transition.days;
      }
      step = transition.to;
      continue;
    }

    /**
     * E0 É ETAPA REAL DA RÉGUA. Quando ainda não existe fila e o
     * primeiro contato não foi executado por fora, a própria V2 cria a
     * primeira ligação da E0 — não existe motor de entrada paralelo
     * gerando obrigação de cadência.
     */
    void isEntry;


    // Vencimento da etapa: estável quando já existe fila; calculado quando não.
    const existingDue = rows.length ? rows.map((r) => r.dueAt).sort()[0]! : null;
    const plan = planDue({
      originDate: anchorDate,
      theoreticalOffset: offset,
      previousExecutionIso: previousExecution,
      usedDates: used,
      immediateFromIso: offset === 0 && step !== V2_FLOW_ENTRY[input.flow]
        ? (input.materialRequestedAt ?? previousExecution)
        : null,
    });
    const stepDueAt = existingDue ?? plan.dueAt;

    const released = nextReleasedAction({
      step,
      stepDueAt,
      states: toActionState(rows),
    });
    if (!released) {
      return {
        kind: "none",
        reason: `Etapa ${step} aguardando o intervalo interno entre as ações.`,
      };
    }

    return {
      kind: "obligation",
      step,
      actionOrder: released.action.order,
      actionKind: released.action.kind,
      label: released.action.label,
      dueAt: released.releaseAt,
      theoreticalDate: plan.theoreticalDate,
      originDate: input.originDate,
      reason: `${step} — ${released.action.label} prevista para ${released.releaseAt}.`,
    };
  }

  return { kind: "none", reason: "Nenhuma etapa aplicável no fluxo." };
}

/** O fluxo do motor antigo corresponde a qual família da régua V2? */
export function v2FlowOf(flow: string): CadenceV2Flow | null {
  if (flow === "sem_resposta") return "E";
  if (flow === "reengajamento") return "R";
  if (flow === "reentrada") return "RE";
  return null;
}

export { flowOfStep };
