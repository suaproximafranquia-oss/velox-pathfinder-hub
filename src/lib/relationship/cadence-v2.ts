/**
 * MOTOR DE CADÊNCIA — RÉGUA FINAL DA FINANCEIRA /f.
 *
 * Módulo PURO e isolado: não conhece banco, rede nem interface, e não é
 * importado por Solar, Seguros ou pelo Portal público. Ele responde a
 * quatro perguntas, e nada mais:
 *
 *   1. qual é a próxima ETAPA do ciclo;
 *   2. em que DIA/HORA ela vence;
 *   3. quais AÇÕES INTERNAS a etapa possui e qual delas está liberada;
 *   4. em qual CONTEXTO (SEM_CONTATO / MATERIAL_ENVIADO) o texto é lido.
 *
 * REGRAS FIXAS (arquitetura aprovada):
 * - Etapas oficiais: E0–E8, R1–R4, RE0–RE3. Nada além disso.
 * - Âncora: data teórica a partir da ORIGEM DO CICLO, tendo a execução
 *   anterior como PISO. Atraso desloca; nunca comprime nem empilha.
 * - Calendário: dias corridos, com sábado → segunda, domingo → terça e
 *   feriado → próximo dia operacional.
 * - Janela da cadência: seg–sex 09:00–17:30, sábado 08:00–16:00,
 *   domingo fechado. E0 NÃO usa esta janela: mantém a configuração
 *   própria por executivo.
 * - Ligação sempre antes de mensagem, dentro da mesma etapa.
 */
import { addDays, weekdayOf } from "./calendar";
import { RELATIONSHIP_CONFIG } from "./config";

// ---------------------------------------------------------------- etapas

export const CADENCE_V2_STEPS = [
  "E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8",
  "R1", "R2", "R3", "R4",
  "RE0", "RE1", "RE2", "RE3",
] as const;

export type CadenceV2Step = (typeof CADENCE_V2_STEPS)[number];

export type CadenceV2Flow = "E" | "R" | "RE";

/** Contexto estruturado do ciclo — nunca deduzido de texto. */
export type CycleContext = {
  /**
   * Existe registro estruturado de apresentação digital enviada
   * (conclusão de E5 ou registro manual equivalente).
   */
  materialSent: boolean;
  /** O lead respondeu ao E4 pedindo/aceitando a apresentação. */
  materialRequested?: boolean;
  /** Reentrada que exige nova apresentação. */
  needsNewPresentation?: boolean;
  /**
   * CAMINHO V — decidido UMA ÚNICA VEZ antes da criação da E1 e
   * congelado no histórico do lead. Quando verdadeiro, E1/E2/E3 são
   * lidas nos contextos V1/V2/V3. Nunca é reconsultado no ciclo.
   */
  visualPath?: boolean;
  /**
   * Existe passagem histórica válida por E4 no HISTÓRICO REAL DO LEAD
   * (não apenas na instância corrente). Define o contexto da R3.
   */
  reachedE4Historically?: boolean;
};

export type StepContext =
  | "SEM_CONTATO"
  | "MATERIAL_ENVIADO"
  | "V1"
  | "V2"
  | "V3"
  | "NAO_CHEGOU_E4"
  | "JA_PASSOU_E4";

/** Contexto do caminho V correspondente a cada etapa E1/E2/E3. */
const VISUAL_CONTEXT_BY_STEP: Readonly<Record<string, StepContext>> = {
  E1: "V1",
  E2: "V2",
  E3: "V3",
};

export function flowOfStep(step: CadenceV2Step): CadenceV2Flow {
  if (step.startsWith("RE")) return "RE";
  if (step.startsWith("R")) return "R";
  return "E";
}

/**
 * Contexto de leitura das etapas E7/E8. Uma única etapa, dois textos —
 * a escolha vem do histórico estruturado do ciclo.
 */
export function resolveStepContext(cycle: CycleContext): StepContext {
  return cycle.materialSent ? "MATERIAL_ENVIADO" : "SEM_CONTATO";
}

// ------------------------------------------------------------ transições

export type Transition = {
  to: CadenceV2Step;
  /** Intervalo em dias de calendário sobre a data teórica anterior. */
  days: number;
  /** Reancora a régua: a etapa acontece imediatamente (sem intervalo). */
  immediate?: boolean;
};

/**
 * Próxima etapa do ciclo. `null` = ciclo encerrado.
 *
 * E: E0 → E1 → E2 → E3 → E4 → E7 → E8 (sem resposta)
 *    E4 → E5 (imediato, quando o lead aceita o material) → E6 → E7 → E8
 * R: R1 → R2 → R3 → R4; com material R2 → R4 (R3 pulada)
 * RE: RE0 → RE1 → RE2 → RE3; sem nova apresentação RE1 → RE3
 */
export function nextTransition(
  current: CadenceV2Step,
  cycle: CycleContext,
): Transition | null {
  switch (current) {
    case "E0":
      return { to: "E1", days: 1 };
    case "E1":
      return { to: "E2", days: 2 };
    case "E2":
      return { to: "E3", days: 2 };
    case "E3":
      return { to: "E4", days: 2 };
    case "E4":
      return cycle.materialRequested
        ? { to: "E5", days: 0, immediate: true }
        : { to: "E7", days: 4 };
    case "E5":
      return { to: "E6", days: 7 };
    case "E6":
      return { to: "E7", days: 2 };
    case "E7":
      return { to: "E8", days: 3 };
    case "E8":
      return null;

    case "R1":
      return { to: "R2", days: 2 };
    case "R2":
      return cycle.materialSent ? { to: "R4", days: 4 } : { to: "R3", days: 2 };
    case "R3":
      return { to: "R4", days: 4 };
    case "R4":
      return null;

    case "RE0":
      return { to: "RE1", days: 1 };
    case "RE1":
      return cycle.needsNewPresentation
        ? { to: "RE2", days: 2 }
        : { to: "RE3", days: 3 };
    case "RE2":
      return { to: "RE3", days: 5 };
    case "RE3":
      return null;
    default:
      return null;
  }
}

/** Caminho completo previsto a partir de uma etapa inicial. */
export function projectedPath(
  first: CadenceV2Step,
  cycle: CycleContext,
): { step: CadenceV2Step; days: number; immediate: boolean }[] {
  const path = [{ step: first, days: 0, immediate: false }];
  let current = first;
  for (let i = 0; i < CADENCE_V2_STEPS.length; i += 1) {
    const next = nextTransition(current, cycle);
    if (!next) break;
    path.push({ step: next.to, days: next.days, immediate: next.immediate === true });
    current = next.to;
  }
  return path;
}

// ------------------------------------------------------------ calendário

export const CADENCE_WINDOWS = {
  /** Segunda a sexta. 17.5 = 17:30. */
  weekday: { start: 9, end: 17.5 },
  /** Sábado é operacional para executar o que já é devido. */
  saturday: { start: 8, end: 16 },
  /** Domingo não executa cadência. */
  sunday: null as { start: number; end: number } | null,
};

function isHoliday(isoDate: string): boolean {
  return RELATIONSHIP_CONFIG.nonBusinessDays.includes(isoDate);
}

/** Janela de execução da cadência num dia (null = fechado). */
export function cadenceWindow(isoDate: string): { start: number; end: number } | null {
  if (isHoliday(isoDate)) return null;
  const weekday = weekdayOf(isoDate);
  if (weekday === 0) return CADENCE_WINDOWS.sunday;
  if (weekday === 6) return CADENCE_WINDOWS.saturday;
  return CADENCE_WINDOWS.weekday;
}

export function isCadenceOpenDay(isoDate: string): boolean {
  return cadenceWindow(isoDate) !== null;
}

/**
 * Próximo dia com janela aberta (inclusive o próprio). Usado para
 * EXECUÇÃO — sábado conta, porque sábado executa o que já é devido.
 */
export function nextOpenDay(isoDate: string): string {
  let date = isoDate;
  for (let i = 0; i < 60 && !isCadenceOpenDay(date); i += 1) date = addDays(date, 1);
  return date;
}

/**
 * DESLOCAMENTO DO VENCIMENTO TEÓRICO.
 *
 * Sábado → segunda. Domingo → terça. Feriado → próximo dia operacional
 * (reaplicando a regra do fim de semana). Sábado nunca recebe vencimento
 * teórico novo, mesmo sendo dia operacional para execução.
 */
export function shiftTheoreticalDate(isoDate: string): string {
  let date = isoDate;
  for (let i = 0; i < 60; i += 1) {
    const weekday = weekdayOf(date);
    if (weekday === 6) {
      date = addDays(date, 2); // sábado → segunda
      continue;
    }
    if (weekday === 0) {
      date = addDays(date, 2); // domingo → terça
      continue;
    }
    if (isHoliday(date)) {
      date = addDays(date, 1);
      continue;
    }
    return date;
  }
  return date;
}

/** Instante ISO da abertura da janela de um dia (operação em UTC-3). */
export function atWindowStart(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const window = cadenceWindow(isoDate) ?? CADENCE_WINDOWS.weekday;
  const utcMinutes = Math.round(window.start * 60) + 3 * 60;
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, utcMinutes, 0)).toISOString();
}

export function localDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RELATIONSHIP_CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function localMinutesOf(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RELATIONSHIP_CONFIG.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return (get("hour") % 24) * 60 + get("minute");
}

/** O instante está dentro da janela da cadência? */
export function isWithinCadenceWindow(iso: string): boolean {
  const window = cadenceWindow(localDateOf(iso));
  if (!window) return false;
  const minutes = localMinutesOf(iso);
  return minutes >= window.start * 60 && minutes < window.end * 60;
}

/**
 * Próxima abertura operacional a partir de um instante. Nunca antecipa:
 * se o instante já está dentro da janela, ele mesmo é devolvido.
 */
export function nextOpenMoment(iso: string): string {
  if (isWithinCadenceWindow(iso)) return iso;
  const date = localDateOf(iso);
  const minutes = localMinutesOf(iso);
  const window = cadenceWindow(date);
  if (window && minutes < window.start * 60) return atWindowStart(date);
  return atWindowStart(nextOpenDay(addDays(date, 1)));
}

// ------------------------------------------------------- âncora e prazos

export type DuePlanInput = {
  /** Data de origem do ciclo (YYYY-MM-DD) — D0. */
  originDate: string;
  /** Soma teórica de dias desde a origem até esta etapa. */
  theoreticalOffset: number;
  /** Execução real da etapa anterior (ISO) — funciona como piso. */
  previousExecutionIso?: string | null;
  /** Datas já ocupadas por outras etapas do MESMO lead. */
  usedDates?: string[];
  /**
   * Etapa imediata (E4 → E5): a régua reancora na resposta do lead, sem
   * intervalo artificial.
   */
  immediateFromIso?: string | null;
};

export type DuePlan = {
  /** Data teórica pura, antes de qualquer deslocamento. */
  theoreticalDate: string;
  /** Data operacional final (YYYY-MM-DD). */
  operationalDate: string;
  /** Momento operacional final (ISO). */
  dueAt: string;
  /** Por que a data final é diferente da teórica, quando for. */
  shiftedBy: ("weekend_or_holiday" | "previous_execution_floor" | "same_day_collision")[];
};

/**
 * Calcula o vencimento de uma etapa segundo a âncora aprovada:
 * data teórica na origem do ciclo + execução anterior como piso, sem
 * duas etapas do mesmo lead no mesmo dia.
 */
export function planDue(input: DuePlanInput): DuePlan {
  const shiftedBy: DuePlan["shiftedBy"] = [];

  const theoreticalDate = input.immediateFromIso
    ? localDateOf(input.immediateFromIso)
    : addDays(input.originDate, input.theoreticalOffset);

  let operational = shiftTheoreticalDate(theoreticalDate);
  if (operational !== theoreticalDate) shiftedBy.push("weekend_or_holiday");

  // Piso: nunca antes da execução real da etapa anterior.
  if (input.previousExecutionIso) {
    const floorDate = localDateOf(input.previousExecutionIso);
    if (operational < floorDate) {
      operational = shiftTheoreticalDate(floorDate);
      shiftedBy.push("previous_execution_floor");
    }
  }

  // Nunca duas etapas do mesmo lead no mesmo dia.
  const used = new Set(input.usedDates ?? []);
  let guard = 0;
  while (used.has(operational) && guard < 60) {
    operational = shiftTheoreticalDate(addDays(operational, 1));
    if (!shiftedBy.includes("same_day_collision")) shiftedBy.push("same_day_collision");
    guard += 1;
  }

  let dueAt = atWindowStart(operational);
  if (input.previousExecutionIso && dueAt <= input.previousExecutionIso) {
    dueAt = nextOpenMoment(input.previousExecutionIso);
    if (!shiftedBy.includes("previous_execution_floor")) {
      shiftedBy.push("previous_execution_floor");
    }
  }

  return { theoreticalDate, operationalDate: localDateOf(dueAt), dueAt, shiftedBy };
}

/**
 * Simulação completa de um ciclo — usada pelos testes e pela
 * homologação. Assume execução no vencimento (sem atraso humano).
 */
export function simulateCycle(input: {
  first: CadenceV2Step;
  originDate: string;
  cycle: CycleContext;
  /** Data/hora da resposta que dispara E5, quando houver. */
  materialRequestedAt?: string | null;
}): { step: CadenceV2Step; dueAt: string; date: string; offsetDays: number }[] {
  const path = projectedPath(input.first, input.cycle);
  const result: { step: CadenceV2Step; dueAt: string; date: string; offsetDays: number }[] = [];
  const used: string[] = [];
  let offset = 0;
  let previousExecution: string | null = null;
  let anchorDate = input.originDate;

  for (const node of path) {
    let plan: DuePlan;
    if (node.immediate) {
      plan = planDue({
        originDate: anchorDate,
        theoreticalOffset: 0,
        previousExecutionIso: previousExecution,
        usedDates: used,
        immediateFromIso: input.materialRequestedAt ?? previousExecution,
      });
      // A régua reancora: as etapas seguintes contam a partir daqui.
      anchorDate = plan.operationalDate;
      offset = 0;
    } else {
      offset += node.days;
      plan = planDue({
        originDate: anchorDate,
        theoreticalOffset: offset,
        previousExecutionIso: previousExecution,
        usedDates: used,
      });
    }
    used.push(plan.operationalDate);
    previousExecution = plan.dueAt;
    result.push({
      step: node.step,
      dueAt: plan.dueAt,
      date: plan.operationalDate,
      offsetDays: daysBetween(input.originDate, plan.operationalDate),
    });
  }
  return result;
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

// ------------------------------------------------------- ações internas

export type StepActionKind = "call" | "message";

export type StepActionPlan = {
  /** Posição obrigatória dentro da etapa (1 = primeira). */
  order: number;
  kind: StepActionKind;
  /** Horas de espera após a ação anterior da MESMA etapa. */
  waitHoursAfterPrevious: number;
  /**
   * Espera em MINUTOS após a ação anterior da mesma etapa. Quando
   * presente, prevalece sobre `waitHoursAfterPrevious` (a E0 usa 10
   * minutos entre a primeira e a segunda ligação).
   */
  waitMinutesAfterPrevious?: number;
  /** Rótulo operacional exibido ao executivo. */
  label: string;
};

/** Espera efetiva, em minutos, entre uma ação e a anterior da etapa. */
export function waitMinutesOf(action: StepActionPlan): number {
  return action.waitMinutesAfterPrevious ?? action.waitHoursAfterPrevious * 60;
}

/**
 * AÇÕES INTERNAS DA ETAPA. Continuam sendo UMA etapa: nunca E1.1/E2.1.
 * A ligação sempre vem antes da mensagem.
 *
 * E0 é etapa real da régua: ligação 1 → 10 minutos → ligação 2 →
 * mensagem (somente se as duas ligações não forem atendidas).
 */
export function stepActions(step: CadenceV2Step): StepActionPlan[] {
  switch (step) {
    case "E0":
      return [
        { order: 1, kind: "call", waitHoursAfterPrevious: 0, label: "Ligação 1" },
        {
          order: 2,
          kind: "call",
          waitHoursAfterPrevious: 0,
          waitMinutesAfterPrevious: 10,
          label: "Ligação 2",
        },
        { order: 3, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" },
      ];
    case "E1":
      return [
        { order: 1, kind: "call", waitHoursAfterPrevious: 0, label: "Ligação 1" },
        { order: 2, kind: "call", waitHoursAfterPrevious: 3, label: "Ligação 2" },
        { order: 3, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" },
      ];
    case "E2":
    case "E3":
    case "E4":
      return [
        { order: 1, kind: "call", waitHoursAfterPrevious: 0, label: "Ligação" },
        { order: 2, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" },
      ];
    default:
      return [{ order: 1, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" }];
  }
}


export type ActionState = {
  order: number;
  status: "PENDING" | "DONE" | "CANCELLED";
  /** Execução real da ação (ISO). */
  executedAt?: string | null;
};

/**
 * Próxima ação LIBERADA da etapa. Devolve `null` quando a etapa está
 * concluída, cancelada por mudança de fluxo, ou quando a próxima ação
 * ainda não pode ser executada (ex.: intervalo de 3 horas em curso).
 */
export function nextReleasedAction(input: {
  step: CadenceV2Step;
  stepDueAt: string;
  states: ActionState[];
  /**
   * Mudança válida de fluxo durante a etapa (lead atendeu, foi para
   * AGENDAMENTO, mudou de estágio, ciclo encerrado…). As ações
   * posteriores deixam de ser cobradas.
   */
  flowChanged?: boolean;
}): { action: StepActionPlan; releaseAt: string } | null {
  if (input.flowChanged) return null;
  const plan = stepActions(input.step);
  const byOrder = new Map(input.states.map((s) => [s.order, s]));

  for (const action of plan) {
    const state = byOrder.get(action.order);
    if (state?.status === "DONE") continue;
    if (state?.status === "CANCELLED") continue;

    const previous = plan.find((p) => p.order === action.order - 1);
    const previousState = previous ? byOrder.get(previous.order) : undefined;
    // Ordem obrigatória: a ação só existe depois da anterior concluída.
    if (previous && previousState?.status !== "DONE") return null;

    let releaseAt = input.stepDueAt;
    const waitMinutes = waitMinutesOf(action);
    if (previous && previousState?.executedAt && waitMinutes > 0) {
      const candidate = new Date(
        Date.parse(previousState.executedAt) + waitMinutes * 60_000,
      ).toISOString();
      releaseAt = candidate;
    } else if (previousState?.executedAt) {
      releaseAt = previousState.executedAt;
    }

    // E0 não usa a janela da régua: sua janela é a própria do executivo
    // (aplicada pela Ação do Dia). As demais etapas vão para a próxima
    // abertura sem se perder.
    if (input.step === "E0") return { action, releaseAt };
    return { action, releaseAt: nextOpenMoment(releaseAt) };
  }
  return null;
}

/** A etapa só conclui quando a última ação aplicável termina. */
export function isStepComplete(step: CadenceV2Step, states: ActionState[]): boolean {
  const plan = stepActions(step);
  const byOrder = new Map(states.map((s) => [s.order, s]));
  return plan.every((a) => {
    const state = byOrder.get(a.order);
    return state?.status === "DONE" || state?.status === "CANCELLED";
  });
}

/**
 * Ordem operacional da Ação do Dia dentro de um lead: ligação sempre
 * antes de mensagem, e a ordem interna da etapa é respeitada.
 */
export function actionSortWeight(kind: StepActionKind, order: number): number {
  return (kind === "call" ? 0 : 1_000) + order;
}

// ------------------------------------------------------------ congelamento

/**
 * AGENDAMENTO congela a cadência. Nenhuma etapa nova de E/R/RE é gerada
 * enquanto o lead permanecer lá — e o simples vencimento do horário do
 * compromisso NÃO inicia o fluxo R.
 */
export function isCadenceFrozen(input: { stageKey: string | null }): boolean {
  return (input.stageKey ?? "").toLowerCase() === "agendamentos";
}

/**
 * Liberação do fluxo R: só depois da movimentação HUMANA de
 * AGENDAMENTOS para FRIOS.
 */
export function canStartReengagement(input: {
  previousStageKey: string | null;
  currentStageKey: string | null;
  movedByHuman: boolean;
}): boolean {
  return (
    input.movedByHuman &&
    (input.previousStageKey ?? "").toLowerCase() === "agendamentos" &&
    (input.currentStageKey ?? "").toLowerCase() === "frio"
  );
}
