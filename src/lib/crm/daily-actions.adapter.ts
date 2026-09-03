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

export type DailyActionsAdapter = {
  /** Rótulo de ambiente; presente somente fora do modo real. */
  demoLabel?: string;
  load: () => Promise<DailyAction[]>;
  executeFirstContact: (item: DailyAction) => Promise<AdapterResult>;
  completeCall: (item: DailyAction, outcome: "SIM" | "NAO") => Promise<AdapterResult>;
  openWhatsapp: (item: DailyAction) => Promise<AdapterResult>;
  /** Abre a ficha completa do investidor. */
  openLead: (item: DailyAction) => void;
};
