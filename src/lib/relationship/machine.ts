/**
 * MÁQUINA DE ESTADOS (COMANDO 2A §88, §89).
 *
 * Função pura: (estado, evento) → novo estado + motivo. Não envia nada,
 * não toca em banco, não conhece produção nem homologação. É a mesma
 * lógica usada pelo simulador e pela operação real.
 */
import { RELATIONSHIP_CONFIG, type RelationshipConfig } from "./config";
import type { CadenceRecord, EngineEvent, EngineEventType } from "./types";

export function initialRecord(input: {
  scope: CadenceRecord["scope"];
  leadId: string;
  runId?: string | null;
  at: string;
  /**
   * Fluxo inicial. Um lead já conhecido que se cadastra novamente nasce
   * em "reentrada" — nunca no fluxo de primeiro contato (COMANDO 2B §1).
   */
  flow?: CadenceRecord["flow"];
}): CadenceRecord {
  return {
    scope: input.scope,
    leadId: input.leadId,
    runId: input.runId ?? null,
    state: "CADENCE_NOT_STARTED",
    previousState: null,
    flow: input.flow ?? "sem_resposta",
    currentStep: null,
    executedSteps: [],
    startedAt: null,
    startedBy: null,
    lastEventType: null,
    lastEventAt: null,
    lastOutboundAt: null,
    lastInboundAt: null,
    lastExecutiveReplyAt: null,
    windowOpenUntil: null,
    readCount: 0,
    responseCount: 0,
    scheduled: false,
    nameConfirmed: false,
    contentHistory: [],
    openingTemplateHistory: [],
    closedAt: null,
    closeReason: null,
    updatedAt: input.at,
  };
}

/** Prioridade dos eventos (§13) — menor número vence. */
export const EVENT_PRIORITY: Record<EngineEventType, number> = {
  SCHEDULE_CREATED: 1,
  SCHEDULE_CANCELLED: 1,
  MANUAL_INTERRUPTION: 2,
  MANUAL_RESUME: 2,
  MESSAGE_RECEIVED: 3,
  CADENCE_CLOSED: 4,
  CADENCE_INTERRUPTED: 4,
  CADENCE_COMPLETED: 4,
  CADENCE_RESUMED: 4,
  MESSAGE_READ: 5,
  MESSAGE_DELIVERED: 6,
  WINDOW_OPENED: 6,
  WINDOW_CLOSED: 6,
  EXECUTIVE_MESSAGE_SENT: 6,
  NAME_CONFIRMED: 6,
  CONTENT_SENT: 7,
  MESSAGE_SENT: 7,
  FIRST_CONTACT_SENT: 7,
  LEAD_CREATED: 8,
};

export type Transition = { record: CadenceRecord; reason: string; changed: boolean };

/**
 * Estados de bloqueio: só um evento de prioridade igual ou superior à
 * do evento que os criou pode retirá-los. É isso que garante, de forma
 * determinística, a ordem AGENDAMENTO > INTERRUPÇÃO > RESPOSTA >
 * VISUALIZAÇÃO > TEMPO (§13) mesmo quando os eventos chegam fora de
 * ordem cronológica.
 */
const LOCKING_STATE_PRIORITY: Partial<Record<CadenceRecord["state"], number>> = {
  SCHEDULED: 1,
  INTERRUPTED: 2,
  PAUSED: 2,
  COMPLETED: 4,
  CLOSED: 4,
};

/** O evento tem autoridade para mudar o estado atual? */
export function canOverrideState(
  currentState: CadenceRecord["state"],
  eventType: EngineEventType,
): boolean {
  const lock = LOCKING_STATE_PRIORITY[currentState];
  if (lock === undefined) return true;
  return EVENT_PRIORITY[eventType] <= lock;
}

function openWindow(at: string, config: RelationshipConfig): string {
  return new Date(new Date(at).getTime() + config.windowHours * 3_600_000).toISOString();
}

/**
 * Aplica um evento ao registro. Eventos históricos apenas alimentam o
 * histórico: nunca reativam cadência nem criam nova etapa (§110).
 */
export function applyEvent(
  record: CadenceRecord,
  event: EngineEvent,
  config: RelationshipConfig = RELATIONSHIP_CONFIG,
): Transition {
  const next: CadenceRecord = {
    ...record,
    executedSteps: [...record.executedSteps],
    contentHistory: [...record.contentHistory],
    openingTemplateHistory: [...record.openingTemplateHistory],
  };
  const before = record.state;
  let reason = "";

  next.lastEventType = event.type;
  next.lastEventAt = event.at;
  next.updatedAt = event.at;

  if (event.historical) {
    return {
      record: next,
      reason: "Evento histórico registrado sem reprocessar cadência.",
      changed: false,
    };
  }

  const setState = (state: CadenceRecord["state"], why: string) => {
    if (!canOverrideState(next.state, event.type)) {
      // Evento de menor prioridade: o fato é registrado (contadores,
      // janela, timestamps), mas o estado de bloqueio permanece.
      reason = `${why} Estado "${next.state}" preservado: evento ${event.type} tem prioridade inferior.`;
      return;
    }
    if (next.state !== state) {
      next.previousState = next.state;
      next.state = state;
    }
    reason = why;
  };

  switch (event.type) {
    case "LEAD_CREATED":
      // Lead já conhecido que volta: nasce direto no fluxo de reentrada
      // (COMANDO 2B §1) — o primeiro contato nunca é repetido.
      if (event.data?.["reentry"] === true) next.flow = "reentrada";
      reason = "Lead registrado no motor; cadência ainda não iniciada.";
      break;

    case "FIRST_CONTACT_SENT":
      next.startedAt = next.startedAt ?? event.at;
      next.startedBy =
        next.startedBy ??
        ((event.data?.["origin"] as "automatic" | "manual" | undefined) ?? "automatic");
      {
        // Reentrada abre em RE0; primeira entrada abre em E0.
        const opening = event.step ?? (next.flow === "reentrada" ? "RE0" : "E0");
        next.currentStep = opening;
        if (!next.executedSteps.includes(opening)) next.executedSteps.push(opening);
      }
      next.lastOutboundAt = event.at;
      setState(
        "CADENCE_ACTIVE",
        next.flow === "reentrada"
          ? "Reentrada iniciada — cadência ativa a partir de RE0."
          : "Primeiro contato enviado — cadência ativa a partir de E0.",
      );
      break;

    case "MESSAGE_SENT":
    case "CONTENT_SENT":
      next.lastOutboundAt = event.at;
      if (event.step) {
        next.currentStep = event.step;
        if (!next.executedSteps.includes(event.step)) next.executedSteps.push(event.step);
      }
      if (event.contentId && !next.contentHistory.includes(event.contentId)) {
        next.contentHistory.push(event.contentId);
      }
      if (event.templateId && !next.openingTemplateHistory.includes(event.templateId)) {
        next.openingTemplateHistory.push(event.templateId);
      }
      if (next.state === "CADENCE_ACTIVE" || next.state === "WAITING_FOR_NEXT_BUSINESS_DAY") {
        setState("WAITING_FOR_RESPONSE", `Etapa ${event.step ?? ""} executada; aguardando retorno.`);
      } else {
        reason = `Etapa ${event.step ?? ""} executada.`;
      }
      break;

    case "MESSAGE_DELIVERED":
      reason = "Entrega confirmada pelo canal.";
      break;

    case "MESSAGE_READ":
      next.readCount += 1;
      if (
        next.flow !== "reentrada" &&
        next.responseCount === 0 &&
        next.readCount >= config.readsToSwitchFlow
      ) {
        next.flow = "visualizacao";
        setState(
          "VISUALIZED_NO_RESPONSE",
          `Investidor visualizou ${next.readCount} mensagens sem responder — fluxo de engajamento por visualização.`,
        );
      } else {
        reason = "Visualização registrada. Visualizar não é responder.";
      }
      break;

    case "MESSAGE_RECEIVED":
      next.responseCount += 1;
      next.lastInboundAt = event.at;
      next.windowOpenUntil = openWindow(event.at, config);
      // §8 — fluxos nunca se misturam: quem responde durante a
      // reentrada permanece na reentrada, apenas com a automação parada.
      if (next.flow !== "reentrada") next.flow = "reengajamento";
      setState(
        "RESPONDED",
        "Investidor respondeu — cadência automática interrompida; o Executivo conduz.",
      );
      break;

    case "EXECUTIVE_MESSAGE_SENT":
      next.lastExecutiveReplyAt = event.at;
      next.lastOutboundAt = event.at;
      reason = "Mensagem do Executivo registrada na conversa.";
      break;

    case "WINDOW_OPENED":
      next.windowOpenUntil = openWindow(event.at, config);
      reason = "Janela de conversação aberta.";
      break;

    case "WINDOW_CLOSED":
      next.windowOpenUntil = null;
      reason = "Janela de conversação fechada.";
      break;

    case "SCHEDULE_CREATED":
      next.scheduled = true;
      setState("SCHEDULED", "Agendamento registrado — cadência interrompida integralmente.");
      break;

    case "SCHEDULE_CANCELLED":
      next.scheduled = false;
      setState(
        "INTERRUPTED",
        "Agendamento cancelado — retomada depende de ação explícita do Executivo.",
      );
      break;

    case "MANUAL_INTERRUPTION":
    case "CADENCE_INTERRUPTED":
      setState("INTERRUPTED", "Cadência interrompida manualmente.");
      break;

    case "MANUAL_RESUME":
    case "CADENCE_RESUMED":
      setState("CADENCE_ACTIVE", "Cadência retomada por ação explícita do Executivo.");
      break;

    case "NAME_CONFIRMED":
      next.nameConfirmed = true;
      reason = "Nome do investidor confirmado.";
      break;

    case "CADENCE_COMPLETED":
      next.closedAt = event.at;
      next.closeReason = (event.data?.["reason"] as string) ?? "Fluxo concluído.";
      setState("COMPLETED", next.closeReason);
      break;

    case "CADENCE_CLOSED":
      next.closedAt = event.at;
      next.closeReason = (event.data?.["reason"] as string) ?? "Cadência encerrada.";
      setState("CLOSED", next.closeReason);
      break;
  }

  return { record: next, reason, changed: next.state !== before };
}

/** A janela livre está aberta neste instante? */
export function isWindowOpen(record: CadenceRecord, nowIso: string): boolean {
  return Boolean(record.windowOpenUntil && record.windowOpenUntil > nowIso);
}

/** Estados que jamais podem coexistir com uma etapa pendente (§89). */
export function blocksAutomation(record: CadenceRecord): string | null {
  if (record.scheduled || record.state === "SCHEDULED") {
    return "Lead em agendamento — todas as etapas automáticas ficam bloqueadas.";
  }
  if (record.state === "INTERRUPTED") return "Cadência interrompida manualmente.";
  if (record.state === "PAUSED") return "Cadência pausada.";
  if (record.state === "COMPLETED" || record.state === "CLOSED") {
    return "Cadência encerrada — nenhuma nova etapa automática é criada.";
  }
  return null;
}