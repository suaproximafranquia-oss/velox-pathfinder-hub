/**
 * AÇÕES DO DIA — normalização e ordenação (camada pura).
 *
 * ETAPA 1. Esta camada NÃO cria tarefas, NÃO altera cadência e NÃO
 * escreve nada: ela apenas LÊ as fontes oficiais já existentes e as
 * apresenta como uma visão única.
 *
 * Fontes oficiais reutilizadas (nenhuma nova é criada):
 *   • `portal_meetings`            → reuniões (prioridade máxima);
 *   • `workspace_agenda_events`    → compromissos da Agenda;
 *   • `relationship_queue`         → mensagens/etapas da jornada;
 *   • `crm_cadence_tasks` (legado) → ligações.
 *
 * DUPLICIDADE: cada ação recebe uma CHAVE DETERMINÍSTICA
 * (`lead + etapa/tipo + instância`). Recarregar, dar refresh, remontar o
 * componente ou ler a mesma obrigação em duas fontes nunca produz dois
 * itens: a chave colide e vence a fonte de maior precedência.
 *
 * FUSO: toda regra de data/hora usa America/Sao_Paulo. O relógio do
 * navegador nunca é regra de negócio — o "agora" chega pronto do
 * servidor.
 */

import { availabilityFromDate, isOverdueByBusinessDays } from "./daily-actions-overdue";

export const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";

/**
 * Antecedência em que uma reunião passa a ocupar o topo da lista.
 * Regra operacional: a reunião entra em foco ~5 minutos antes do
 * horário e PERMANECE na lista (como atrasada) até ser resolvida.
 */
export const MEETING_FOCUS_WINDOW_MS = 5 * 60 * 1000;

export type DailyActionSource =
  | "first_contact"
  | "meeting"
  | "agenda"
  | "closure"
  | "queue"
  | "cadence"
  /** Ligação atendida sem encaminhamento registrado — decisão humana. */
  | "handoff";
export type DailyActionKind =
  | "primeiro_contato"
  | "reuniao"
  | "compromisso"
  | "mensagem"
  | "ligacao";
export type DailyActionBucket = "agora" | "atrasada" | "hoje" | "futura";

export type CadenceAttemptView = { step: number; date: string; outcome: "SIM" | "NAO" };

/** Dados necessários para concluir uma tentativa de ligação na origem. */
export type CadenceRef = {
  /** `crm_leads.id` — identidade exigida pelo motor legado de ligações. */
  crmLeadId: string;
  step: number;
  dueDate: string;
  cycleDate: string;
};

export type DailyAction = {
  /** `source:lead:etapa|tipo:instância` — estável entre leituras. */
  actionKey: string;
  source: DailyActionSource;
  kind: DailyActionKind;
  /** Identidade operacional do lead (`portal_leads.id`). */
  leadId: string | null;
  name: string;
  phone: string;
  /** Carteira/origem do lead — preservada ao abrir a ficha. */
  scope: string | null;
  /** Rótulo curto da etapa/tentativa ("2ª tentativa", "E1"). */
  stepLabel: string | null;
  /** Data operacional (America/Sao_Paulo, YYYY-MM-DD). */
  dueDate: string;
  /** Instante do compromisso, quando existir. */
  startsAt: string | null;
  endsAt: string | null;
  overdue: boolean;
  priorityMax: boolean;
  bucket: DailyActionBucket;
  title: string;
  responsibleName: string | null;
  cadence?: CadenceRef;
  /** Ação de Primeiro Contato (E0) pendente de execução manual (legado). */
  firstContactActionId?: string;
  /** Item da fila da régua V2 (`relationship_queue.id`), quando for da fila. */
  queueItemId?: string;
  /** Ordem da ação interna dentro da etapa (1 = ligação 1, 2 = 2ª ligação, 3 = mensagem). */
  queueActionOrder?: number;
  /** Limite da tentativa adicional E1/E2, calculado pelo calendário vigente. */
  expiresAt?: string;
  /** Ação reivindicada pelo executivo (PROCESSING) — posição 1 protegida. */
  claimed?: boolean;
  /** Reunião de origem (`portal_meetings.id`), quando for uma reunião. */
  meetingId?: string;
  /**
   * Compromisso ESPELHADO do follow_up do GreenSales (Financeira /f).
   * `mode = "contato"`: perguntar se houve contato de agendamento.
   * `mode = "revisao_24h"`: obrigação de decidir encerrar ou retomar.
   * Reagendamento acontece SOMENTE no GreenSales — nunca aqui.
   */
  followUp?: {
    mode: "contato" | "revisao_24h";
    state: string | null;
    scheduledAt: string;
    reviewDueAt: string | null;
  };
  /**
   * Mensagem oficial da jornada: identifica a etapa para que a tela
   * possa LER o texto na Biblioteca. Nenhuma cópia é feita aqui.
   */
  messageRef?: { step: string; flow: string | null; origin: "queue" | "closure" };
  attempts: CadenceAttemptView[];
  /**
   * Pendências de menor precedência do MESMO lead. Continuam disponíveis
   * para consulta/conclusão, mas nunca geram um segundo card.
   */
  secondary?: DailyAction[];
};

/** Data operacional (YYYY-MM-DD) de um instante, em America/Sao_Paulo. */
export function operationalDate(value: string | number | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: OPERATIONAL_TIME_ZONE });
}

/** Hora operacional (HH:MM) de um instante, em America/Sao_Paulo. */
export function operationalTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    timeZone: OPERATIONAL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "1ª tentativa", "2ª tentativa"… — apenas apresentação do que já existe. */
export function attemptLabel(step: number): string {
  return `${step}ª tentativa`;
}

/**
 * Classificação temporal. Uma ação atrasada NUNCA é convertida em ação
 * de hoje: ela continua atrasada até ter encerramento operacional.
 */
export function resolveBucket(input: {
  dueDate: string;
  startsAt: string | null;
  nowIso: string;
  focusWindowMs?: number;
}): DailyActionBucket {
  const today = operationalDate(input.nowIso);
  const nowMs = new Date(input.nowIso).getTime();
  const window = input.focusWindowMs ?? MEETING_FOCUS_WINDOW_MS;

  if (input.startsAt) {
    const startMs = new Date(input.startsAt).getTime();
    if (Number.isFinite(startMs)) {
      if (startMs <= nowMs) return startMs < nowMs - window ? "atrasada" : "agora";
      if (startMs - nowMs <= window) return "agora";
      /**
       * COMPROMISSO COM HORÁRIO AINDA POR VIR NÃO É TRABALHO DE AGORA —
       * mesmo sendo hoje. Ele fica em "próximos compromissos" até entrar
       * na janela de foco (T-5) e nunca disputa a posição 1.
       */
      return "futura";
    }
  }

  if (!input.dueDate) return "hoje";
  if (input.dueDate < today) return "atrasada";
  if (input.dueDate === today) return "hoje";
  return "futura";
}

/**
 * Ordem determinística (nunca a ordem de criação do registro):
 *   0. reunião/compromisso de prioridade máxima em foco ou atrasado;
 *   1. LEAD NOVO (primeiro contato / E0);
 *   2. ação atrasada;
 *   3. ação que vence hoje;
 *   4. demais ações;
 *   6. COMPROMISSO FUTURO — nunca disputa a fila de hoje.
 */
export function actionRank(action: DailyAction): number {
  /**
   * POSIÇÃO 1 PROTEGIDA: a ação já reivindicada pelo executivo (em
   * atendimento) não é deslocada por novas liberações da régua.
   */
  if (action.claimed) return 0;
  /**
   * COMPROMISSO DE OUTRO DIA NÃO É TRABALHO DE HOJE. Ele continua
   * visível como "próximo compromisso", mas nunca ocupa a posição 1 nem
   * compete com E0/E1/E2 — prioridade máxima só vale no dia ou em atraso.
   */
  if (action.bucket === "futura") return 6;
  // LEAD NOVO — E0 legada ou E0 da régua V2 (ligação/mensagem).
  if (action.source === "first_contact") return 2;
  if (action.source === "queue" && action.stepLabel === "E0") return 2;
  if (action.priorityMax) {
    if (action.bucket === "agora" || action.bucket === "atrasada") return 0;
    return 1;
  }
  if (action.bucket === "atrasada") return 3;
  if (action.bucket === "agora" || action.bucket === "hoje") return 4;
  return 5;
}

/** Compromisso de outro dia: visível, porém não executável hoje. */
export function isUpcomingAction(action: DailyAction): boolean {
  return action.bucket === "futura";
}



/**
 * CONTINUIDADE DA MESMA LEAD (contexto da sessão, nunca persistido).
 *
 * Quando o Executivo acaba de concluir uma ação de um investidor e essa
 * conclusão libera a PRÓXIMA ação do MESMO investidor (por exemplo a
 * Mensagem E0 logo após a 2ª ligação), essa próxima ação passa à frente
 * das ações de OUTRAS leads de mesmo rank. Não altera rank, cadência,
 * histórico nem prioridade permanente: é apenas desempate momentâneo.
 */
export function sortDailyActions(
  actions: DailyAction[],
  continuityLeadId?: string | null,
): DailyAction[] {
  return [...actions].sort((a, b) => {
    /**
     * EXCEÇÃO À PROTEÇÃO DA POSIÇÃO 1: a continuação do trabalho da MESMA
     * lead não é uma ação nova disputando a vez — ela permanece na
     * posição 1, inclusive à frente de ações já reivindicadas de outras
     * leads. Compromissos de outro dia nunca são promovidos.
     */
    if (continuityLeadId) {
      const aLead = a.leadId === continuityLeadId && a.bucket !== "futura" ? 0 : 1;
      const bLead = b.leadId === continuityLeadId && b.bucket !== "futura" ? 0 : 1;
      if (aLead !== bLead) return aLead - bLead;
    }
    const rank = actionRank(a) - actionRank(b);
    if (rank !== 0) return rank;
    const aKey = a.startsAt ?? `${a.dueDate}T23:59:59.999Z`;
    const bKey = b.startsAt ?? `${b.dueDate}T23:59:59.999Z`;
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    return a.actionKey < b.actionKey ? -1 : a.actionKey > b.actionKey ? 1 : 0;
  });
}

/** Reclassificação somente visual; não consulta, cria ou executa obrigações. */
export function reclassifyDailyActions(actions: DailyAction[], nowIso: string, continuityLeadId?: string | null): DailyAction[] {
  const rows = actions.filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > Date.parse(nowIso)).map((a) => {
    const bucket = a.source === "queue"
      ? (isOverdueByBusinessDays(availabilityFromDate(a.dueDate), nowIso) ? "atrasada" : a.dueDate > operationalDate(nowIso) ? "futura" : "hoje")
      : a.startsAt ? resolveBucket({ dueDate: a.dueDate, startsAt: a.startsAt, nowIso }) : a.bucket;
    return { ...a, bucket, overdue: bucket === "atrasada" };
  });
  return sortDailyActions(rows, continuityLeadId);
}

/**
 * Precedência entre fontes que podem representar A MESMA obrigação
 * operacional. A de maior precedência permanece; a outra é descartada.
 */
const SOURCE_PRECEDENCE: Record<DailyActionSource, number> = {
  /**
   * PRIMEIRO CONTATO (E0) de lead novo: prioridade máxima da operação
   * comercial — é a única etapa cujo atraso custa a entrada do lead.
   */
  first_contact: 0,
  /** Encaminhamento pendente vem antes de qualquer nova tentativa. */
  handoff: 1,
  meeting: 1,
  agenda: 2,
  /**
   * Fechamento do ciclo (E27 / FINALIZAÇÃO da Apresentação Digital).
   * Vence a cadência corrente: é o compromisso já assumido com o
   * investidor a partir de um convite emitido.
   */
  closure: 3,
  /**
   * ORDEM INTERNA DA ETAPA: a LIGAÇÃO sempre vem antes da MENSAGEM.
   * Uma mensagem nunca aparece para execução antes da ligação prevista
   * da mesma etapa — por isso a ligação tem precedência sobre a fila de
   * mensagens quando as duas estão pendentes no mesmo lead.
   */
  cadence: 4,
  queue: 5,

};

/** Colapsa ações repetidas pela chave determinística. */
export function dedupeDailyActions(actions: DailyAction[]): DailyAction[] {
  const byKey = new Map<string, DailyAction>();
  for (const action of actions) {
    const current = byKey.get(action.actionKey);
    if (!current || SOURCE_PRECEDENCE[action.source] < SOURCE_PRECEDENCE[current.source]) {
      byKey.set(action.actionKey, action);
    }
  }
  return [...byKey.values()];
}

/**
 * UM LEAD = UMA AÇÃO OFICIAL VISÍVEL.
 *
 * Quando o mesmo lead tem reunião, mensagem e ligação pendentes, apenas a
 * de maior precedência vira card; as demais ficam em `secondary`.
 * Compromissos sem lead (`leadId === null`) nunca são colapsados.
 */
export function collapseByLead(actions: DailyAction[]): DailyAction[] {
  const byLead = new Map<string, DailyAction>();
  const loose: DailyAction[] = [];
  for (const action of actions) {
    if (!action.leadId) {
      loose.push(action);
      continue;
    }
    const current = byLead.get(action.leadId);
    if (!current) {
      byLead.set(action.leadId, action);
      continue;
    }
    const winner =
      SOURCE_PRECEDENCE[action.source] < SOURCE_PRECEDENCE[current.source] ? action : current;
    const other = winner === action ? current : action;
    byLead.set(action.leadId, {
      ...winner,
      secondary: [...(winner.secondary ?? []), ...(other.secondary ?? []), { ...other, secondary: undefined }],
    });
  }
  return [...loose, ...byLead.values()];
}

/** Pipeline completo de apresentação: deduplicar, colapsar por lead e ordenar. */
export function normalizeDailyActions(
  actions: DailyAction[],
  continuityLeadId?: string | null,
): DailyAction[] {
  return sortDailyActions(collapseByLead(dedupeDailyActions(actions)), continuityLeadId);
}

export type DailyActionsSummary = {
  overdue: number;
  today: number;
  meetings: number;
  total: number;
};

export function summarizeDailyActions(actions: DailyAction[]): DailyActionsSummary {
  let overdue = 0;
  let today = 0;
  let meetings = 0;
  for (const action of actions) {
    if (action.bucket === "atrasada") overdue += 1;
    else if (action.bucket === "agora" || action.bucket === "hoje") today += 1;
    if (action.kind === "reuniao") meetings += 1;
  }
  return { overdue, today, meetings, total: actions.length };
}

/** Rótulos de interface — o CRM nunca inventa nomes de etapa. */
export const KIND_LABEL: Record<DailyActionKind, string> = {
  primeiro_contato: "Primeiro contato (E0)",
  reuniao: "Reunião",
  compromisso: "Compromisso",
  mensagem: "Mensagem",
  ligacao: "Ligação",
};
