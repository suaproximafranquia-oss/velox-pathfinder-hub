/**
 * DECISÃO DO MOTOR (COMANDO 2A §2, §57, §94).
 *
 * Antes de qualquer disparo o motor pergunta: "este lead ainda está
 * elegível para receber esta etapa?". A resposta é sempre acompanhada
 * de um motivo legível — tanto para enviar quanto para não enviar.
 */
import { dueMomentAfterBusinessDays, isEligibleMoment, nextEligibleMoment } from "./calendar";
import { FLOW_SEQUENCE, RELATIONSHIP_CONFIG, STEPS, type RelationshipConfig } from "./config";
import { blocksAutomation, isWindowOpen } from "./machine";
import { planBusinessDays, planSequence, type FlowPlan } from "./flow-plan";
import { isTerminalStage, isAutomationEligibleStage } from "./closing";
import type { CadenceFlow, CadenceRecord, CadenceStep, EngineAction } from "./types";

/** Etapas de PRIMEIRO CONTATO — as únicas permitidas enquanto o lead está em NOVOS. */
const FIRST_CONTACT_STEPS: CadenceStep[] = ["E0", "E0_V1"];

/** Evento de referência do fluxo atual para o cálculo de dias úteis. */
function referenceMoment(record: CadenceRecord, ctx?: DecisionContext): string | null {
  if (record.flow === "reengajamento") {
    return record.lastInboundAt ?? record.lastOutboundAt ?? record.startedAt;
  }
  const base = record.lastOutboundAt ?? record.startedAt;
  /**
   * A cadência de acompanhamento (E1 em diante) só começa a contar da
   * SAÍDA do lead da coluna NOVOS — a primeira ação humana. Nunca do
   * simples cadastro nem da E0.
   */
  const left = ctx?.leftEntryStageAt ?? null;
  if (!left) return base;
  if (!base) return left;
  return base > left ? base : left;
}

/**
 * BLOCO 4 — a sequência operacional vem da VERSÃO DO FLUXO do ciclo
 * quando ela existe. Ciclo legado (sem versão) continua na sequência do
 * `config.ts`, sem qualquer reescrita.
 */
function sequenceOf(flow: CadenceFlow, plan?: FlowPlan | null): CadenceStep[] {
  if (plan && plan.flowKey === flow) {
    const sequence = planSequence(plan);
    if (sequence.length > 0) return sequence;
  }
  return FLOW_SEQUENCE[flow] ?? [];
}

/** Próxima etapa permitida do fluxo — nunca fora de ordem. */
export function nextStep(record: CadenceRecord, plan?: FlowPlan | null): CadenceStep | null {
  const sequence = sequenceOf(record.flow, plan);
  for (const step of sequence) {
    if (!record.executedSteps.includes(step)) return step;
  }
  return null;
}

/** A etapa respeita a ordem do fluxo? */
export function isStepInOrder(
  flow: CadenceFlow,
  step: CadenceStep,
  executed: CadenceStep[],
  plan?: FlowPlan | null,
) {
  const sequence = sequenceOf(flow, plan);
  const index = sequence.indexOf(step);
  if (index < 0) return false;
  return sequence.slice(0, index).every((prev) => executed.includes(prev));
}

export type DecisionContext = {
  nowIso: string;
  /** Template oficial associado à finalidade existe e está aprovado? */
  hasTemplateForPurpose: (purpose: string) => boolean;
  /** Motor habilitado neste ambiente. */
  enabled?: boolean;
  config?: RelationshipConfig;
  /**
   * Etapa do lead na origem no FECHAMENTO do dia (COMANDO 3D §3, §4).
   * Quando informada, é ela — e não a etapa "de agora" — que autoriza
   * ou impede a criação de novas etapas automáticas.
   */
  stageAtClosing?: string | null;
  /**
   * O lead continua na coluna de entrada (NOVOS) aguardando a primeira
   * ação humana. Enquanto for true, nenhuma etapa após a E0 é criada.
   */
  awaitingFirstHumanAction?: boolean;
  /** Instante em que o lead saiu de NOVOS — referência real da E1. */
  leftEntryStageAt?: string | null;
  /**
   * BLOCO 4 — versão de fluxo congelada no nascimento do ciclo. Quando
   * presente, é ela que define quais etapas participam, em que ordem e
   * com que prazo. Ausente (ciclo legado) ⇒ comportamento anterior.
   */
  flowPlan?: FlowPlan | null;
};

/**
 * Única função autorizada a dizer o que acontece com um lead agora.
 */
export function decideNextAction(record: CadenceRecord, ctx: DecisionContext): EngineAction {
  const config = ctx.config ?? RELATIONSHIP_CONFIG;
  const enabled = ctx.enabled ?? config.enabled;

  if (!enabled) {
    return { kind: "none", reason: "Motor desabilitado — nenhum novo disparo é criado." };
  }

  if (ctx.stageAtClosing !== undefined) {
    if (isTerminalStage(ctx.stageAtClosing)) {
      return {
        kind: "none",
        reason:
          "Lead em OPORTUNIDADE no fechamento do dia — etapa terminal: nenhuma cadência automática é criada.",
      };
    }
    if (!isAutomationEligibleStage(ctx.stageAtClosing)) {
      return {
        kind: "none",
        reason: `Etapa "${ctx.stageAtClosing ?? "sem etapa"}" no fechamento do dia não é elegível para cadência automática.`,
      };
    }
  }

  const blocked = blocksAutomation(record);
  if (blocked) return { kind: "none", reason: blocked };

  if (record.state === "RESPONDED" && record.flow === "reengajamento") {
    // Respondeu: só volta a agir depois do silêncio de N dias úteis.
    const reference = record.lastInboundAt;
    if (!reference) {
      return { kind: "none", reason: "Resposta registrada sem data — nada é executado." };
    }
    const due = dueMomentAfterBusinessDays(reference, config.reengagementBusinessDays, config);
    if (ctx.nowIso < due) {
      return {
        kind: "none",
        reason: `Investidor respondeu em ${reference}; o Executivo conduz até ${due}.`,
      };
    }
  }

  // §8 — na reentrada, uma resposta encerra a automação: o Executivo
  // conduz e o motor não cria novas etapas do fluxo RE.
  if (record.flow === "reentrada" && record.responseCount > 0) {
    return {
      kind: "none",
      reason: "Investidor respondeu durante a reentrada — a condução passa a ser do Executivo.",
    };
  }

  const plan = ctx.flowPlan ?? null;
  const step = nextStep(record, plan);
  if (!step) {
    return { kind: "none", reason: "Todas as etapas do fluxo já foram executadas." };
  }
  if (!isStepInOrder(record.flow, step, record.executedSteps, plan)) {
    return { kind: "none", reason: `Etapa ${step} fora de ordem no fluxo ${record.flow}.` };
  }
  if (record.executedSteps.includes(step)) {
    return { kind: "none", reason: `Etapa ${step} já executada — nenhuma repetição é permitida.` };
  }

  /**
   * NOVOS = "lead recebido, aguardando a primeira ação humana". A E0 é
   * o único disparo permitido; a cadência de acompanhamento só começa
   * depois que o Executivo movimenta o lead para fora de NOVOS.
   */
  if (ctx.awaitingFirstHumanAction && !FIRST_CONTACT_STEPS.includes(step)) {
    return {
      kind: "none",
      reason:
        "Lead ainda em NOVOS — aguardando a primeira ação humana. A cadência de acompanhamento não é iniciada.",
    };
  }

  const definition = STEPS[step] ?? {
    step,
    flow: record.flow,
    businessDaysAfterReference: 0,
    templatePurpose: "conteudo_relacionamento",
    contentGroup: null,
    terminal: false,
  };
  /**
   * COMANDO 4A §8 — a E30 é contada a partir do INÍCIO DA JORNADA
   * (regra já definida em `reactivation.ts`), não da última mensagem.
   * As demais etapas seguem a referência padrão do fluxo.
   */
  const reference =
    step === "E30" ? (record.startedAt ?? referenceMoment(record, ctx)) : referenceMoment(record, ctx);
  if (!reference) {
    return { kind: "none", reason: "Cadência sem evento de referência — etapa não é criada." };
  }

  /**
   * BLOCO 4 §13 — o prazo de um ciclo VERSIONADO vem da associação
   * fluxo↔etapa. As regras de calendário (dias úteis, janelas,
   * feriados) continuam exatamente as mesmas: muda só a ORIGEM do
   * número de dias.
   */
  const plannedDays = plan ? planBusinessDays(plan, step) : null;
  const businessDays =
    record.flow === "reengajamento"
      ? config.reengagementBusinessDays
      : (plannedDays ?? definition.businessDaysAfterReference);
  const dueAt = dueMomentAfterBusinessDays(reference, businessDays, config);

  if (ctx.nowIso < dueAt) {
    return {
      kind: "schedule_step",
      step,
      flow: record.flow,
      dueAt,
      reason: `Etapa ${step} programada para ${dueAt} (dias úteis e horário operacional aplicados).`,
    };
  }

  if (!isEligibleMoment(ctx.nowIso, config)) {
    // Sempre para frente: o próximo instante operacional válido depois
    // de agora — nunca o início do dia que já passou.
    const next = nextEligibleMoment(ctx.nowIso, config);
    return {
      kind: "schedule_step",
      step,
      flow: record.flow,
      dueAt: next,
      reason: `Momento atual fora do dia útil/horário permitido — ${step} reagendada para ${next}.`,
    };
  }

  const windowOpen = isWindowOpen(record, ctx.nowIso);
  const requiresTemplate = !windowOpen;
  if (requiresTemplate && config.requireOfficialTemplate) {
    const purpose = definition.templatePurpose;
    if (!ctx.hasTemplateForPurpose(purpose)) {
      return {
        kind: "none",
        reason: `Janela de 24 horas fechada e não existe template oficial associado à finalidade "${purpose}" — envio bloqueado.`,
      };
    }
  }

  return {
    kind: "send_step",
    step,
    flow: record.flow,
    requiresTemplate,
    templatePurpose: definition.templatePurpose,
    contentGroup: definition.contentGroup,
    reason: windowOpen
      ? `Janela aberta: ${step} enviada como mensagem do motor.`
      : `Janela fechada: ${step} enviada através do template oficial de ${definition.templatePurpose}.`,
  };
}