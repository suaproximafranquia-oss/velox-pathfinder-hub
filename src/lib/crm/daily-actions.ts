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
 * horário; após a janela permanece aberta, sem bloquear a operação.
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
  | "handoff"
  /** Sinal informativo de atividade real do investidor no Portal. */
  | "portal_alert";
export type DailyActionKind =
  | "primeiro_contato"
  | "reuniao"
  | "compromisso"
  | "mensagem"
  | "ligacao"
  | "manual"
  | "alerta_portal";
export type DailyActionBucket =
  | "agora"
  | "atrasada"
  | "hoje"
  | "futura"
  | "pendente"
  /** Aviso: visível, nunca executável, nunca disputa a posição 1. */
  | "alerta";

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
  /** Instante real usado somente como desempate cronológico da fila. */
  sortAt?: string | null;
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
  /** Ordem histórica da ação interna dentro da etapa. */
  queueActionOrder?: number;
  /** Compatibilidade histórica: novas obrigações não recebem expiração. */
  expiresAt?: string;
  /** Primeira ligação E0: atendimento exige decisão explícita, inclusive na segunda-feira. */
  e0AttendedChoice?: boolean;
  /** Estado persistido da fila (`PROCESSING`); não implica blindagem visual. */
  claimed?: boolean;
  /** Único card efetivamente ativo nesta leitura da Ação do Dia. */
  active?: boolean;
  /** Reunião de origem (`portal_meetings.id`), quando for uma reunião. */
  meetingId?: string;
  /**
   * Compromisso ESPELHADO do follow_up do GreenSales (Financeira /f).
   * Pergunta pelo comparecimento e pela intenção de novo agendamento.
   * Reagendamento acontece SOMENTE no GreenSales — nunca aqui.
   */
  followUp?: {
    state: string | null;
    scheduledAt: string;
  };
  /**
   * Mensagem oficial da jornada: identifica a etapa para que a tela
   * possa LER o texto na Biblioteca. Nenhuma cópia é feita aqui.
   */
  messageRef?: { step: string; flow: string | null; origin: "queue" | "closure" };
  /**
   * AVISO DO PORTAL: instante REAL do acesso registrado pelo servidor.
   * Apresentação apenas — não é obrigação, prazo nem compromisso.
   */
  alertAt?: string;
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

/** Decisão pura da neutralização comercial; a escrita continua no servidor. */
export function shouldNeutralizeQueueDuty(input: {
  step: string;
  stageKey: string | null;
  hasCommitment: boolean;
  firstContactExecuted: boolean;
}): boolean {
  const stage = String(input.stageKey ?? "").toLowerCase();
  const frozen = new Set([
    "agendamentos", "video", "oportunidade", "cof/contrato", "cof_contrato",
    "contrato", "pagamento", "remarketing", "vencemos", "finalizado",
  ]).has(stage);
  if (!frozen) return false;
  return input.step !== "E0" || input.firstContactExecuted;
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
   * POSIÇÃO 1 PROTEGIDA: somente o card efetivamente ativo na interface
   * não é deslocado por novas liberações da régua. `PROCESSING` sozinho
   * continua preservado no dado, mas não recebe prioridade máxima.
   */
  if (action.active) return -1;
  /**
   * AVISO DO PORTAL: entra depois das emergências em foco e antes dos
   * leads novos. Continua sendo apenas sinal informativo.
   */
  if (action.bucket === "alerta") return 1;
  if (action.bucket === "pendente") return 7;
  /**
   * COMPROMISSO DE OUTRO DIA NÃO É TRABALHO DE HOJE. Ele continua
   * visível como "próximo compromisso", mas nunca ocupa a posição 1 nem
   * compete com E0/E1/E2 — prioridade máxima só vale no dia ou em atraso.
   */
  if (action.bucket === "futura") return 6;
  // ABERTURA — E0 e RE0 compartilham somente a classe de prioridade visual.
  if (action.source === "first_contact") return 2;
  if (action.source === "queue" && (action.stepLabel === "E0" || action.stepLabel === "RE0")) return 2;
  if (action.priorityMax) {
    if (action.bucket === "agora" || action.bucket === "atrasada") return 0;
    return 1;
  }
  if (action.bucket === "atrasada") return 3;
  if (action.bucket === "agora" || action.bucket === "hoje") return 4;
  return 5;
}

/** Pendências abertas são acessíveis sob demanda, nunca escolhidas automaticamente. */
export function isAutomaticDailyAction(action: DailyAction): boolean {
  return (
    action.bucket !== "futura" &&
    action.bucket !== "pendente"
  );
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
    /** Somente o card efetivamente ativo nunca é interrompido. */
    const active = Number(Boolean(b.active)) - Number(Boolean(a.active));
    if (active !== 0) return active;
    /**
     * A continuação do trabalho da MESMA lead não é uma ação nova
     * disputando a vez. Ela permanece na posição 1 depois que a ação
     * anterior foi concluída. Compromissos futuros nunca são promovidos.
     */
    if (continuityLeadId) {
      const aLead = a.leadId === continuityLeadId && isAutomaticDailyAction(a) ? 0 : 1;
      const bLead = b.leadId === continuityLeadId && isAutomaticDailyAction(b) ? 0 : 1;
      if (aLead !== bLead) return aLead - bLead;
    }
    const rank = actionRank(a) - actionRank(b);
    if (rank !== 0) return rank;
    const aKey = a.startsAt ?? a.sortAt ?? `${a.dueDate}T23:59:59.999Z`;
    const bKey = b.startsAt ?? b.sortAt ?? `${b.dueDate}T23:59:59.999Z`;
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    return a.actionKey < b.actionKey ? -1 : a.actionKey > b.actionKey ? 1 : 0;
  });
}

/** Reclassificação somente visual; não consulta, cria ou executa obrigações. */
export function reclassifyDailyActions(actions: DailyAction[], nowIso: string, continuityLeadId?: string | null): DailyAction[] {
  const flatten = (rows: DailyAction[]): DailyAction[] => rows.flatMap((a) => [{ ...a, secondary: undefined }, ...flatten(a.secondary ?? [])]);
  const rows = flatten(actions)
    .filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > Date.parse(nowIso))
    .map((a) => {
    const bucket = a.source === "queue" || a.source === "closure"
      ? (isOverdueByBusinessDays(availabilityFromDate(a.dueDate), nowIso) ? "atrasada" : a.dueDate > operationalDate(nowIso) ? "futura" : "hoje")
      : a.startsAt ? resolveBucket({ dueDate: a.dueDate, startsAt: a.startsAt, nowIso }) : a.bucket;
    return { ...a, bucket, overdue: bucket === "atrasada" };
  });
  return normalizeDailyActions(rows, continuityLeadId);
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
  /** Aviso nunca substitui obrigação comercial: menor precedência. */
  portal_alert: 9,

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
    // O aviso do Portal convive com a ação comercial do mesmo lead.
    if (!action.leadId || action.bucket === "pendente" || action.bucket === "alerta") {
      loose.push(action);
      continue;
    }
    const current = byLead.get(action.leadId);
    if (!current) {
      byLead.set(action.leadId, action);
      continue;
    }
    /**
     * Exceção operacional estreita: um agendamento urgente do mesmo lead
     * não pode desaparecer atrás da ação ativa. Ambos seguem
     * visíveis; nenhuma outra combinação deixa de ser colapsada.
     */
    const activeAndUrgentMeeting =
      (current.active && action.source === "meeting" && action.bucket === "agora") ||
      (action.active && current.source === "meeting" && current.bucket === "agora");
    if (activeAndUrgentMeeting) {
      const activeAction = action.active ? action : current;
      const meetingAction = action.active ? current : action;
      byLead.set(action.leadId, activeAction);
      loose.push(meetingAction);
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
  manual: "Ação manual",
  alerta_portal: "Atividade no Portal",
};
