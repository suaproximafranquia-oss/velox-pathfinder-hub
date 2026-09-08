/**
 * CONTRATO DA AÇÃO DO DIA — apenas tipos.
 *
 * O painel de Ações do Dia não conhece tabela, servidor ou origem: ele
 * recebe um ADAPTADOR com as poucas operações de que precisa. O modo
 * real liga esse adaptador às funções oficiais; o modo demonstração
 * liga a dados em memória.
 *
 * Este arquivo NÃO importa nada além de tipos puros — nenhuma server
 * function, nenhum cliente de banco.
 */
import type { DailyAction } from "@/lib/crm/daily-actions";

export type AdapterResult = {
  ok: boolean;
  /** Mensagem curta exibida no painel. */
  message?: string;
  /**
   * Quando verdadeiro, o item volta para o FINAL da fila em vez de
   * sair dela. Usado apenas pela demonstração (fila contínua).
   */
  requeue?: boolean;
};

/** Mensagem oficial da etapa, lida da Biblioteca ativa. */
export type StepMessageView = {
  step: string;
  body: string | null;
  blockedReason: string | null;
  libraryVersion: number | null;
  investorNameUsed: string | null;
  executiveName: string | null;
  contentName: string | null;
  contentUrl: string | null;
};

export type DailyActionsAdapter = {
  /** Rótulo de ambiente; presente somente fora do modo real. */
  demoLabel?: string;
  load: () => Promise<DailyAction[]>;
  executeFirstContact: (item: DailyAction) => Promise<AdapterResult>;
  /** `rang` só é informado quando o investidor NÃO atendeu. */
  completeCall: (
    item: DailyAction,
    outcome: "SIM" | "NAO",
    rang?: boolean | null,
  ) => Promise<AdapterResult>;
  /** Desfaz o último resultado de ligação da régua V2 (quando ainda reversível). */
  undoCallOutcome?: (item: DailyAction) => Promise<AdapterResult>;
  openWhatsapp: (item: DailyAction) => Promise<AdapterResult>;
  /** Pular exige justificativa; o histórico é obrigatório. */
  skip: (item: DailyAction, reason: string) => Promise<AdapterResult>;
  /** Observação operacional vinculada à ação. */
  addNote: (item: DailyAction, note: string) => Promise<AdapterResult>;
  /** Leitura da mensagem oficial da etapa (nunca envia). */
  loadMessage: (item: DailyAction) => Promise<StepMessageView | null>;
  /** Registra que a mensagem foi tratada pela interface. */
  registerMessage: (item: DailyAction, note: string) => Promise<AdapterResult>;
  /** Desfecho da reunião: compareceu ou não compareceu. */
  resolveMeeting: (
    item: DailyAction,
    attended: boolean,
    note: string,
  ) => Promise<AdapterResult>;
  /** Reagendamento da reunião para uma nova data/hora. */
  rescheduleMeeting: (
    item: DailyAction,
    scheduledAt: string,
    note: string,
  ) => Promise<AdapterResult>;
  /**
   * FINANCEIRA /f — agendamento espelhado do GreenSales.
   * "Houve contato de agendamento?" (SIM/NÃO) e, no NÃO, "Deseja reagendar?".
   */
  resolveFollowUpContact: (
    item: DailyAction,
    decision: { contacted: boolean; willReschedule?: boolean; note: string },
  ) => Promise<AdapterResult>;
  /** Obrigação de 24h — encerrar (SIM) ou retomar em Frios (NÃO). */
  resolveFollowUpReview: (
    item: DailyAction,
    decision: { close: boolean; note: string },
  ) => Promise<AdapterResult>;
  /**
   * PENDÊNCIAS PULADAS — leitura opcional (o modo demonstração não tem).
   * Não é uma segunda fila: é o histórico dos pulos ainda em aberto.
   */
  listPendings?: () => Promise<SkippedPendingView[]>;
  /** Devolve a MESMA ação pulada para a fila de hoje. */
  resumePending?: (actionKey: string) => Promise<AdapterResult>;
};

/** Pendência pulada ainda em aberto, como a interface precisa exibir. */
export type SkippedPendingView = {
  actionKey: string;
  leadId: string | null;
  title: string | null;
  step: string | null;
  motivo: string | null;
  skippedAt: string;
  skippedDate: string;
  retomadaHoje: boolean;
};



