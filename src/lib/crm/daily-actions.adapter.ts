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
  /**
   * FILA OFICIAL RECALCULADA PELO SERVIDOR logo após a conclusão.
   * Quando presente, é ELA que comanda a transição: se o mesmo
   * investidor tiver outra ação liberada, ela já vem na posição 1.
   */
  queue?: DailyAction[];
  /** Atualização visual confirmada ao concluir uma atividade do Portal. */
  viewedAt?: string;
  leadId?: string | null;
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
  /** A chave ativa preserva somente o card que está aberto nesta interface. */
  load: (activeActionKey?: string | null) => Promise<DailyAction[]>;
  executeFirstContact: (item: DailyAction) => Promise<AdapterResult>;
  /** `rang` só é informado quando o investidor NÃO atendeu. */
  completeCall: (
    item: DailyAction,
    outcome: "SIM" | "NAO",
    rang?: boolean | null,
  ) => Promise<AdapterResult>;
  completeCallAndMessage?: (
    item: DailyAction,
    outcome: "SIM" | "NAO",
    rang: boolean | null | undefined,
    note: string,
  ) => Promise<AdapterResult>;
  /** Desfaz o último resultado de ligação da régua V2 (quando ainda reversível). */
  undoCallOutcome?: (item: DailyAction) => Promise<AdapterResult>;
  openWhatsapp: (item: DailyAction) => Promise<AdapterResult>;
  /** Pular exige justificativa; o histórico é obrigatório. */
  skip: (item: DailyAction, reason: string) => Promise<AdapterResult>;
  /** Observação operacional vinculada à ação. */
  addNote: (item: DailyAction, note: string) => Promise<AdapterResult>;
  /** Leitura da mensagem oficial da etapa (nunca envia). */
  loadMessage: (
    item: DailyAction,
    context?: "SEM_CONTATO" | "CONTATO_REALIZADO",
  ) => Promise<StepMessageView | null>;
  /**
   * PRÉ-GATILHO: aquece o caminho do "Concluído" no servidor. Somente
   * leitura — não efetiva, não grava e não avança nada.
   */
  prewarmOutcome?: () => void;
  /** Registra que a mensagem foi tratada pela interface. */
  registerMessage: (item: DailyAction, note: string) => Promise<AdapterResult>;
  /** Conclui apresentação/material manual na mesma fila, sem Biblioteca. */
  completeManual: (item: DailyAction, note: string) => Promise<AdapterResult>;
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
   * "Compareceu?" e, em ambos os resultados, "Deseja fazer novo agendamento?".
   */
  resolveFollowUpContact: (
    item: DailyAction,
    decision: { attended: boolean; willReschedule: boolean; note: string },
  ) => Promise<AdapterResult>;
  /**
   * PENDÊNCIAS PULADAS — leitura opcional (o modo demonstração não tem).
   * Não é uma segunda fila: é o histórico dos pulos ainda em aberto.
   */
  listPendings?: () => Promise<SkippedPendingView[]>;
  /** Devolve a MESMA ação pulada para a fila de hoje. */
  resumePending?: (actionKey: string) => Promise<AdapterResult>;
  /**
   * ALERTA DE ATIVIDADE DO PORTAL — encerra apenas o aviso. Não conclui
   * obrigação, não move cadência e não envia nada ao investidor.
   */
  concludeAlert?: (item: DailyAction) => Promise<AdapterResult>;
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



