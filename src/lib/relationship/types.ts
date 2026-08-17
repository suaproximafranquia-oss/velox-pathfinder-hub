/**
 * MOTOR DE RELACIONAMENTO — vocabulário único (COMANDO 2A).
 *
 * Todo o conhecimento do motor vive nesta pasta. Nenhum componente de
 * interface, rota ou serviço deve reimplementar estas regras: eles
 * apenas leem o que o motor decide.
 */

/** Ambientes isolados. Nunca compartilham dados nem estados críticos. */
export type EngineScope = "production" | "homologation";

/** Fluxos possíveis — o comportamento do investidor escolhe o fluxo. */
export type CadenceFlow =
  | "sem_resposta" // Fluxo 1 — nunca responde
  | "visualizacao" // Fluxo 2 — visualiza e não responde
  | "reengajamento" // Fluxo 3 — respondeu e desapareceu
  | "reentrada"; // Fluxo 4 — lead já conhecido que se cadastra de novo

/**
 * Etapas do motor. São identificadores internos (nunca exibidos ao
 * Executivo) e NÃO significam dias corridos.
 */
export type CadenceStep =
  | "E0" // primeiro contato
  | "E1" // primeiro acompanhamento
  | "E3" // segundo acompanhamento
  | "E4" // acompanhamento mais firme
  | "E12" // encerramento do fluxo sem resposta
  | "V3" // acompanhamento específico de quem visualiza e não responde
  | "V4" // acompanhamento firme do fluxo de visualização
  | "R1" // primeira tentativa de reengajamento
  | "R2" // segunda tentativa de reengajamento
  | "R3" // interrupção das tentativas
  | "RE0" // reentrada — retomada do contato
  | "RE1" // reentrada — como avaliar uma franquia
  | "RE2" // reentrada — estrutura e suporte
  | "RE3"; // reentrada — encerramento

/** Estados persistentes da cadência. */
export type CadenceState =
  | "CADENCE_NOT_STARTED"
  | "CADENCE_ACTIVE"
  | "WAITING_FOR_RESPONSE"
  | "WAITING_FOR_NEXT_BUSINESS_DAY"
  | "VISUALIZED_NO_RESPONSE"
  | "RESPONDED"
  | "RESPONDED_THEN_SILENT"
  | "SCHEDULED"
  | "PAUSED"
  | "INTERRUPTED"
  | "COMPLETED"
  | "CLOSED";

/** Eventos aceitos pelo motor. Toda decisão nasce de um evento. */
export type EngineEventType =
  | "LEAD_CREATED"
  | "FIRST_CONTACT_SENT"
  | "MESSAGE_SENT"
  | "MESSAGE_DELIVERED"
  | "MESSAGE_READ"
  | "MESSAGE_RECEIVED"
  | "EXECUTIVE_MESSAGE_SENT"
  | "WINDOW_OPENED"
  | "WINDOW_CLOSED"
  | "SCHEDULE_CREATED"
  | "SCHEDULE_CANCELLED"
  | "MANUAL_INTERRUPTION"
  | "MANUAL_RESUME"
  | "NAME_CONFIRMED"
  | "CONTENT_SENT"
  | "CADENCE_INTERRUPTED"
  | "CADENCE_RESUMED"
  | "CADENCE_COMPLETED"
  | "CADENCE_CLOSED";

export type EngineEvent = {
  /** Identificador estável — a mesma id nunca é aplicada duas vezes. */
  id: string;
  scope: EngineScope;
  leadId: string;
  type: EngineEventType;
  /** Momento real (ISO). No relógio virtual é o instante virtual. */
  at: string;
  /** Evento importado de histórico anterior: não reativa cadência. */
  historical?: boolean;
  step?: CadenceStep;
  templateId?: string | null;
  contentId?: string | null;
  data?: Record<string, unknown>;
};

/** Snapshot persistente do relacionamento de um lead. */
export type CadenceRecord = {
  scope: EngineScope;
  leadId: string;
  /** Rodada de homologação a que o registro pertence (null em produção). */
  runId: string | null;
  state: CadenceState;
  previousState: CadenceState | null;
  flow: CadenceFlow;
  currentStep: CadenceStep | null;
  /** Etapas já executadas — base da idempotência e da ordem. */
  executedSteps: CadenceStep[];
  startedAt: string | null;
  /** Início manual ou automático do primeiro contato. */
  startedBy: "automatic" | "manual" | null;
  lastEventType: EngineEventType | null;
  lastEventAt: string | null;
  lastOutboundAt: string | null;
  lastInboundAt: string | null;
  lastExecutiveReplyAt: string | null;
  /** Fecha 24h após a última interação válida do investidor. */
  windowOpenUntil: string | null;
  readCount: number;
  responseCount: number;
  scheduled: boolean;
  nameConfirmed: boolean;
  /** Conteúdos de valor já enviados, em ordem. */
  contentHistory: string[];
  /** Templates de abertura já utilizados, em ordem. */
  openingTemplateHistory: string[];
  closedAt: string | null;
  closeReason: string | null;
  updatedAt: string;
};

export type QueueStatus =
  | "PENDING"
  | "PROCESSING"
  | "EXECUTED"
  | "BLOCKED"
  | "CANCELLED"
  | "FAILED";

export type QueueItem = {
  id: string;
  scope: EngineScope;
  runId: string | null;
  leadId: string;
  flow: CadenceFlow;
  step: CadenceStep;
  /** Momento previsto (ISO) já ajustado a dia útil e horário permitido. */
  dueAt: string;
  priority: number;
  status: QueueStatus;
  attempts: number;
  executedAt: string | null;
  result: string | null;
  reason: string | null;
};

/** Ação que o motor autoriza — nunca um texto inventado. */
export type EngineAction =
  | {
      kind: "send_step";
      step: CadenceStep;
      flow: CadenceFlow;
      /** true quando a janela está fechada e a etapa exige template. */
      requiresTemplate: boolean;
      templatePurpose: string;
      contentGroup: string | null;
      reason: string;
    }
  | { kind: "schedule_step"; step: CadenceStep; flow: CadenceFlow; dueAt: string; reason: string }
  | { kind: "none"; reason: string };

/** Toda decisão do motor é explicável. */
export type EngineDecision = {
  scope: EngineScope;
  runId: string | null;
  leadId: string;
  at: string;
  step: CadenceStep | null;
  flow: CadenceFlow;
  stateBefore: CadenceState;
  stateAfter: CadenceState;
  outcome: "sent" | "scheduled" | "blocked" | "cancelled" | "failed" | "noop";
  /** Motivo legível — responde "por que enviou / por que não enviou". */
  reason: string;
  templateId?: string | null;
  templateVersion?: number | null;
  contentId?: string | null;
  error?: string | null;
};