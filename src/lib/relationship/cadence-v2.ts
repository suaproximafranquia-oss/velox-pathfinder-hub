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
 *   4. em qual CONTEXTO editorial o texto é lido, quando a etapa o exige.
 *
 * REGRAS FIXAS (arquitetura aprovada):
 * - Etapas oficiais: E0–E8, R1–R5, RE0–RE5. Nada além disso.
 * - Âncora: execução REAL da etapa anterior. Atraso desloca; nunca
 *   comprime, compensa ou empilha etapas no mesmo dia.
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
  "R1", "R2", "R3", "R4", "R5",
  "RE0", "RE1", "RE2", "RE3", "RE4", "RE5",
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
  /** O material foi solicitado dentro da instância atual. */
  materialRequestedInCycle?: boolean;
  /** O material foi enviado dentro da instância atual. */
  materialSentInCycle?: boolean;
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
  | "CONTATO_REALIZADO"
  | "MATERIAL_ENVIADO"
  | "V1"
  | "V2"
  | "V3"
  | "NAO_CHEGOU_E4"
  | "JA_PASSOU_E4";

/**
 * Contexto do caminho V correspondente a cada etapa. A E1 SAIU do eixo
 * V: ela acontece sempre como etapa normal, dando ao investidor mais um
 * intervalo para acessar o material antes do contexto V. "V1" continua
 * existindo apenas como chave histórica na Biblioteca.
 */
const VISUAL_CONTEXT_BY_STEP: Readonly<Record<string, StepContext>> = {
  E2: "V2",
  E3: "V3",
};

export function flowOfStep(step: CadenceV2Step): CadenceV2Flow {
  if (step.startsWith("RE")) return "RE";
  if (step.startsWith("R")) return "R";
  return "E";
}

/**
 * CONTEXTO DE LEITURA DE UMA ETAPA. Uma única etapa técnica, textos
 * próprios por contexto — a escolha vem sempre do histórico
 * estruturado, nunca de texto de conversa ou de interpretação.
 *
 *  • E6 → contexto único após a apresentação da E5;
 *  • E7/E8 → material efetivamente enviado ou não;
 *  • E2/E3 → caminho V já decidido pelo motor (V2/V3) ou contexto
 *    normal (sem contexto); E1 é sempre normal;
 *  • R3 → passagem histórica válida por E4.
 *
 * Sem a etapa informada, mantém o comportamento anterior (E7/E8).
 */
export function resolveStepContext(
  cycle: CycleContext,
  step?: CadenceV2Step | string | null,
): StepContext | null {
  const key = step ? String(step).trim().toUpperCase() : null;

  if (key && VISUAL_CONTEXT_BY_STEP[key]) {
    return cycle.visualPath ? VISUAL_CONTEXT_BY_STEP[key]! : null;
  }
  // E1 saiu do eixo V: é sempre a etapa normal, sem contexto.
  if (key === "E1") return null;
  if (key === "E6") return null;
  if (key === "R3" || key === "R5" || key === "RE2") {
    return cycle.materialSent ? "MATERIAL_ENVIADO" : "SEM_CONTATO";
  }
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
 * R: R1 → R2 → R3 → R5; quando há envio manual após R3, R3 → R4 → R5.
 * RE: RE0 → RE1 → RE2 → RE3 → RE4 → RE5.
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
        : { to: "E7", days: 3 };
    case "E5":
      return { to: "E6", days: 7 };
    case "E6":
      return { to: "E7", days: 2 };
    case "E7":
      return { to: "E8", days: 2 };
    case "E8":
      return null;

    case "R1":
      return { to: "R2", days: 2 };
    case "R2":
      return { to: "R3", days: 2 };
    case "R3":
      return cycle.materialSentInCycle ? { to: "R4", days: 7 } : { to: "R5", days: 4 };
    case "R4":
      return { to: "R5", days: 4 };
    case "R5":
      return null;

    case "RE0":
      return { to: "RE1", days: 1 };
    case "RE1":
      return { to: "RE2", days: 2 };
    case "RE2":
      return { to: "RE3", days: 5 };
    case "RE3":
      return { to: "RE4", days: 7 };
    case "RE4":
      return { to: "RE5", days: 5 };
    case "RE5":
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

/**
 * Data operacional congelada da E0, derivada uma única vez da entrada real.
 * O corte é 18:00; sexta à noite e todo o fim de semana acumulam para segunda.
 */
export function e0OperationalDate(entryIso: string): string {
  const entryDate = localDateOf(entryIso);
  const weekday = weekdayOf(entryDate);
  if (weekday === 6) return shiftTheoreticalDate(entryDate);
  if (weekday === 0) return shiftTheoreticalDate(addDays(entryDate, 1));
  if (localMinutesOf(entryIso) < 18 * 60) return entryDate;
  return shiftTheoreticalDate(addDays(entryDate, 1));
}

/** A estrutura da E0 permanece congelada na data operacional da entrada. */
export function e0StructureDate(
  originDate: string,
  _nowIso: string,
  _states: ActionState[],
): string {
  return originDate;
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
 * Semântica única dos intervalos comerciais: `days` é a distância direta
 * entre as duas datas. A data da execução anterior é D0; não existe um dia
 * de espera adicional antes da soma.
 */
export function theoreticalDateAfterInterval(originDate: string, days: number): string {
  return addDays(originDate, days);
}

/**
 * Calcula o vencimento de uma etapa segundo a âncora aprovada:
 * data teórica na origem do ciclo + execução anterior como piso, sem
 * duas etapas do mesmo lead no mesmo dia.
 */
export function planDue(input: DuePlanInput): DuePlan {
  const shiftedBy: DuePlan["shiftedBy"] = [];

  const theoreticalDate = input.immediateFromIso
    ? localDateOf(input.immediateFromIso)
    : theoreticalDateAfterInterval(input.originDate, input.theoreticalOffset);

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

export type StepActionKind = "call" | "message" | "manual";

export type StepActionPlan = {
  /** Posição obrigatória dentro da etapa (1 = primeira). */
  order: number;
  kind: StepActionKind;
  /** Horas de espera após a ação anterior da MESMA etapa. */
  waitHoursAfterPrevious: number;
  /**
   * Espera em MINUTOS após a ação anterior da mesma etapa. Quando
   * presente, prevalece sobre `waitHoursAfterPrevious` para preservar
   * compatibilidade com esperas históricas.
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
 * Toda etapa composta é uma unidade operacional: uma ligação seguida da
 * mensagem oficial. As ordens históricas das mensagens são preservadas.
 */
export function isOperationalMonday(isoDate: string | null | undefined): boolean {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  return weekdayOf(isoDate) === 1;
}

export function stepActions(
  step: CadenceV2Step,
  _compensateE2 = false,
  operationalDate?: string | null,
): StepActionPlan[] {
  switch (step) {
    case "E0":
      return [
        { order: 1, kind: "call", waitHoursAfterPrevious: 0, label: "Ligação" },
        { order: 3, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" },
      ];
    case "E1":
      return [
        { order: 1, kind: "call", waitHoursAfterPrevious: 0, label: "Ligação" },
        // Mantém a ordem histórica da mensagem para não duplicar filas existentes.
        { order: 3, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" },
      ];
    case "E2":
      return [
        { order: 1, kind: "call", waitHoursAfterPrevious: 0, label: "Ligação" },
        { order: 2, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" },
      ];
    case "E3":
    case "E4":
    case "E7":
    case "R1":
    case "R2":
    case "RE1":
    case "RE0":
    case "RE3":
      return [
        { order: 1, kind: "call", waitHoursAfterPrevious: 0, label: "Ligação" },
        { order: 2, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" },
      ];
    case "E5":
      return [{ order: 1, kind: "manual", waitHoursAfterPrevious: 0, label: "Apresentação / envio de material" }];
    case "E6":
    case "E8":
    case "R3":
    case "R4":
    case "R5":
    case "RE2":
    case "RE4":
    case "RE5":
      return [{ order: 1, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" }];
    default:
      return [{ order: 1, kind: "message", waitHoursAfterPrevious: 0, label: "Mensagem" }];
  }
}


export type ActionState = {
  order: number;
  status: "PENDING" | "DONE" | "CANCELLED";
  /** Execução real da ação (ISO). */
  executedAt?: string | null;
  /** Resultado estruturado da ligação, quando esta ação é uma ligação. */
  result?: string | null;
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
  compensateE2?: boolean;
  /** Data operacional que define exclusivamente o plano da E0. */
  operationalDate?: string | null;
  /**
   * Mudança válida de fluxo durante a etapa (lead atendeu, foi para
   * AGENDAMENTO, mudou de estágio, ciclo encerrado…). As ações
   * posteriores deixam de ser cobradas.
   */
  flowChanged?: boolean;
}): { action: StepActionPlan; releaseAt: string } | null {
  if (input.flowChanged) return null;
  const plan = stepActions(input.step, input.compensateE2, input.operationalDate);
  const byOrder = new Map(input.states.map((s) => [s.order, s]));

  for (let index = 0; index < plan.length; index += 1) {
    const action = plan[index]!;
    const state = byOrder.get(action.order);
    if (state?.status === "DONE") continue;
    if (state?.status === "CANCELLED") continue;

    // Toda mensagem de etapa composta depende da única ligação da etapa.
    const firstCallDependent = plan[0]?.kind === "call" && action.kind === "message";
    const previous = firstCallDependent ? plan.find((p) => p.order === 1) : plan[index - 1];
    const previousState = previous ? byOrder.get(previous.order) : undefined;
    // Ordem obrigatória: a ação só existe depois da anterior concluída.
    const e0ContactMade =
      input.step === "E0" &&
      action.kind === "message" &&
      input.states.some((candidate) => candidate.status === "DONE" && candidate.result === "SIM");
    if (previous && previousState?.status !== "DONE" && !e0ContactMade) return null;

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
    if (input.step === "E0" || firstCallDependent) return { action, releaseAt };
    return { action, releaseAt: nextOpenMoment(releaseAt) };
  }
  return null;
}

/** A etapa só conclui quando a última ação aplicável termina. */
export function isStepComplete(
  step: CadenceV2Step,
  states: ActionState[],
  compensateE2 = false,
  operationalDate?: string | null,
): boolean {
  const plan = stepActions(step, compensateE2, operationalDate);
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
  return (kind === "call" ? 0 : kind === "manual" ? 500 : 1_000) + order;
}

// ------------------------------------------------------------ congelamento

/**
 * A cadência normal existe somente no corredor ZERO_CONTATO/FRIO.
 * Estágios comerciais posteriores congelam pela própria etapa atual,
 * sem depender da existência de follow_up.
 */
export const COMMITMENT_STAGE_KEYS = ["agendamentos", "video"] as const;
export const FROZEN_CADENCE_STAGE_KEYS = [
  "agendamentos",
  "video",
  "oportunidade",
  "cof/contrato",
  "cof_contrato",
  "contrato",
  "pagamento",
  "remarketing",
  "vencemos",
  "finalizado",
] as const;

export function isCommitmentStage(stageKey: string | null): boolean {
  return (COMMITMENT_STAGE_KEYS as readonly string[]).includes((stageKey ?? "").toLowerCase());
}

export function isCadenceFrozen(input: {
  stageKey: string | null;
  hasCommitment?: boolean;
}): boolean {
  const stage = (input.stageKey ?? "").toLowerCase();
  return (FROZEN_CADENCE_STAGE_KEYS as readonly string[]).includes(stage);
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
