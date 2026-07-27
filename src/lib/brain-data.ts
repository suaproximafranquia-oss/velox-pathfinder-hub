/**
 * Brain Analytics — camada de dados simulados.
 * Os componentes consomem apenas os tipos e funcoes deste arquivo.
 * A substituicao futura por dados reais nao exige alteracao visual.
 * Nenhuma regra pode depender de um workspace especifico.
 */
import type { ScopeSelection } from "./brain/scopes";
import type { ExecutiveSession } from "./executive-auth";
import {
  loadDataset,
  summarize,
  sumRow,
  type KpiDataset,
} from "./kpi-manager";
import { visibleCollaborators } from "./teams";

export type BrainKpi = {
  id: string;
  label: string;
  value: string;
  delta: number;
  description: string;
  tooltip: string;
  /** Chave semantica do icone; o componente mapeia para Lucide. */
  icon:
    | "users"
    | "sparkles"
    | "video"
    | "fileCheck"
    | "handshake"
    | "trophy"
    | "activity"
    | "clock";
};

export type FunnelStage = { id: string; label: string; value: number };
export type SeriesPoint = { x: string; y: number };

export type BrainSnapshot = {
  period: 30;
  scope: ScopeSelection;
  kpis: BrainKpi[];
  funnel: FunnelStage[];
};

function summarizeMany(datasets: KpiDataset[]) {
  return datasets.reduce(
    (acc, ds) => {
      const s = summarize(ds);
      acc.leads += s.leads;
      acc.calls += s.calls;
      acc.presentations += s.presentations;
      acc.contractsSent += s.contractsSent;
      acc.sales += s.sales;
      acc.salesValue += s.salesValue;
      acc.videosDone += sumRow(ds.matrix, "videosDone");
      return acc;
    },
    {
      leads: 0,
      calls: 0,
      presentations: 0,
      contractsSent: 0,
      sales: 0,
      salesValue: 0,
      videosDone: 0,
    },
  );
}

function buildOperationalFunnel(totals: ReturnType<typeof summarizeMany>): FunnelStage[] {
  return [
    { id: "leads", label: "Lead", value: totals.leads },
    { id: "presentations", label: "Apresentação", value: totals.presentations },
    { id: "videos", label: "Videoconferência", value: totals.videosDone },
    { id: "cofs", label: "COF enviada", value: totals.contractsSent },
    { id: "sales", label: "Venda", value: totals.sales },
    { id: "revenue", label: "Faturamento", value: totals.salesValue },
  ];
}

export function buildOperationalSnapshot(
  session: ExecutiveSession,
  scope: ScopeSelection,
  monthKey: string,
): BrainSnapshot {
  const collaborators = visibleCollaborators(session);
  const selectedUsers =
    scope.mode === "executive"
      ? collaborators.filter((u) => u.id === (scope.executiveId ?? session.userId))
      : collaborators;
  const datasets = selectedUsers.map((u) => loadDataset(u.id, monthKey));
  const totals = summarizeMany(datasets);
  const videosDone = totals.videosDone;

  const kpis: BrainKpi[] = [
    {
      id: "leads",
      label: "Leads",
      value: fmtInt(totals.leads),
      delta: 0,
      description: "Entradas registradas",
      tooltip: "Total de leads registrados no KPI Manager.",
      icon: "users",
    },
    {
      id: "presentations",
      label: "Apresentações",
      value: fmtInt(totals.presentations),
      delta: 0,
      description: "Conversas consultivas",
      tooltip: "Apresentações registradas para o escopo selecionado.",
      icon: "sparkles",
    },
    {
      id: "videos",
      label: "Videoconferências",
      value: fmtInt(videosDone),
      delta: 0,
      description: "Reuniões realizadas",
      tooltip: "Videoconferências realizadas no período.",
      icon: "video",
    },
    {
      id: "cofs",
      label: "COFs Enviadas",
      value: fmtInt(totals.contractsSent),
      delta: 0,
      description: "Propostas formais",
      tooltip: "Contratos/COFs enviados no KPI Manager.",
      icon: "fileCheck",
    },
    {
      id: "sales",
      label: "Vendas",
      value: fmtInt(totals.sales),
      delta: 0,
      description: "Fechamentos concluídos",
      tooltip: "Vendas feitas no período selecionado.",
      icon: "trophy",
    },
    {
      id: "revenue",
      label: "Faturamento",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(totals.salesValue),
      delta: 0,
      description: "Pagamentos registrados",
      tooltip: "Soma de pagamentos feitos no dia no KPI Manager.",
      icon: "handshake",
    },
  ];

  return {
    period: 30,
    scope,
    kpis,
    funnel: buildOperationalFunnel(totals),
  };
}

const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));

// ---------- Alertas persistentes ----------

export type AlertPriority = "alta" | "media" | "baixa";

export type AlertCategory =
  | "contato"
  | "followup"
  | "portal"
  | "contrato"
  | "reuniao"
  | "oportunidade"
  | "desempenho"
  | "meta"
  | "documento"
  | "inatividade"
  | "crescimento";

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  contato: "Contato",
  followup: "Follow-up",
  portal: "Portal",
  contrato: "Contrato",
  reuniao: "Reuniao",
  oportunidade: "Oportunidade",
  desempenho: "Desempenho",
  meta: "Meta",
  documento: "Documento",
  inatividade: "Inatividade",
  crescimento: "Crescimento",
};

export type BrainAlert = {
  id: string;
  ownerUserId: string;
  category: AlertCategory;
  title: string;
  description: string;
  priority: AlertPriority;
  /** ISO datetime — data + hora ficam na mesma origem. */
  date: string;
  /** Mensagem sugerida para o botao Copiar. */
  copyTemplate: string;
  dismissed?: boolean;
};

const ALERTS_KEY = "atlas:brain:alerts:v2";

const SEED_ALERTS: BrainAlert[] = [
  {
    id: "alert_novos",
    ownerUserId: "usr_thiago",
    category: "contato",
    title: "⚠ 12 novos investidores aguardando contato",
    description:
      "Registros recebidos recentemente ainda nao tiveram primeiro contato.",
    priority: "alta",
    date: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    copyTemplate:
      "Ola. Vi que voce chegou recentemente ao nosso Portal e quero me apresentar como seu consultor. Fico a disposicao para conversar quando fizer sentido para voce.",
  },
  {
    id: "alert_followup",
    ownerUserId: "usr_marton",
    category: "followup",
    title: "📅 5 follow-ups programados para hoje",
    description: "Interacoes agendadas com investidores em avaliacao.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    copyTemplate:
      "Ola. Retomando nossa conversa: separei alguns pontos que podem ajudar na sua decisao. Posso te ligar hoje?",
  },
  {
    id: "alert_portal",
    ownerUserId: "usr_paulo",
    category: "portal",
    title: "📋 Um investidor concluiu o Manual",
    description:
      "Investidor finalizou os 13 capitulos do Manual — momento ideal para o primeiro contato consultivo.",
    priority: "baixa",
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    copyTemplate:
      "Ola. Vi que voce concluiu o Manual do Investidor. Posso separar um horario para conversarmos sobre os proximos passos?",
  },
  {
    id: "alert_contratos",
    ownerUserId: "usr_milton",
    category: "contrato",
    title: "⚠ Contratos aguardando retorno",
    description: "Propostas enviadas ha mais de 48h sem resposta.",
    priority: "alta",
    date: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    copyTemplate:
      "Ola. Passando aqui para confirmar se voce recebeu o contrato e se posso esclarecer alguma duvida.",
  },
  {
    id: "alert_reuniao",
    ownerUserId: "usr_carlos",
    category: "reuniao",
    title: "📅 Videoconferencia agendada em breve",
    description: "Reuniao consultiva marcada para as proximas horas.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    copyTemplate:
      "Ola. Confirmando nossa videoconferencia. Assim que estiver pronto, envio o link de acesso.",
  },
  {
    id: "alert_oportunidade",
    ownerUserId: "usr_talita",
    category: "oportunidade",
    title: "⚠ Oportunidades paradas ha mais de 7 dias",
    description:
      "Registros parados na esteira consultiva sem novas interacoes.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    copyTemplate:
      "Ola. Notei que faz alguns dias desde nossa ultima conversa. Posso te ajudar com alguma pendencia?",
  },
  {
    id: "alert_aniversario",
    ownerUserId: "usr_thiago",
    category: "contato",
    title: "🎂 Aniversario de investidor hoje",
    description:
      "Um investidor da sua carteira comemora aniversario hoje — uma mensagem gera conexao.",
    priority: "baixa",
    date: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    copyTemplate:
      "Ola. Passando aqui apenas para desejar um feliz aniversario. Que seja um ciclo novo bonito para voce.",
  },
  {
    id: "alert_kpi",
    ownerUserId: "usr_marton",
    category: "oportunidade",
    title: "📊 KPI de ontem ainda pendente",
    description:
      "Indicadores do dia util anterior ainda nao foram lancados — atualize quando puder.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    copyTemplate:
      "Lembrete interno: registrar no KPI Manager os indicadores do dia util anterior.",
  },
  {
    id: "alert_campanha",
    ownerUserId: "usr_carlos",
    category: "oportunidade",
    title: "🏆 Voce esta a um passo do proximo nivel da Campanha Velox",
    description:
      "Faltam poucos pagamentos para atingir o proximo patamar da campanha.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    copyTemplate:
      "Meta pessoal: sustentar o ritmo desta semana para consolidar o proximo patamar da Campanha Velox.",
  },
  {
    id: "alert_manual_concluido_2",
    ownerUserId: "usr_larissa",
    category: "portal",
    title: "📋 Investidora concluiu o Manual",
    description:
      "Investidora vinculada finalizou o Manual — momento oportuno para conversa consultiva.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    copyTemplate:
      "Ola. Vi que voce finalizou o Manual. Posso separar um horario esta semana para conversarmos com calma?",
  },
  {
    id: "alert_reuniao_2",
    ownerUserId: "usr_paulo",
    category: "reuniao",
    title: "📅 Reuniao consultiva confirmada para amanha",
    description: "Reuniao com investidor em estagio final de avaliacao.",
    priority: "alta",
    date: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    copyTemplate:
      "Ola. Confirmando nossa reuniao de amanha. Se preferir remarcar, me avise que ajusto a agenda.",
  },
  {
    id: "alert_aguardando_2",
    ownerUserId: "usr_talita",
    category: "contato",
    title: "⚠ Investidor aguardando retorno ha 2 dias",
    description:
      "Investidor pediu contato e ainda nao houve retorno registrado.",
    priority: "alta",
    date: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
    copyTemplate:
      "Ola. Desculpe a demora em retornar. Sigo a disposicao para conversar quando fizer sentido para voce.",
  },
];

export function loadAlerts(): BrainAlert[] {
  if (typeof window === "undefined") return SEED_ALERTS;
  try {
    const raw = window.localStorage.getItem(ALERTS_KEY);
    if (!raw) {
      window.localStorage.setItem(ALERTS_KEY, JSON.stringify(SEED_ALERTS));
      return SEED_ALERTS;
    }
    const arr = JSON.parse(raw) as Partial<BrainAlert>[];
    if (!Array.isArray(arr)) return SEED_ALERTS;
    return arr.map((a, index) => ({
      ...SEED_ALERTS[index % SEED_ALERTS.length],
      ...a,
      ownerUserId: a.ownerUserId ?? SEED_ALERTS[index % SEED_ALERTS.length].ownerUserId,
    }));
  } catch {
    return SEED_ALERTS;
  }
}

export function saveAlerts(alerts: BrainAlert[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function visibleAlertsFor(
  session: ExecutiveSession,
  scope: ScopeSelection,
): BrainAlert[] {
  const alerts = loadAlerts();
  if (session.activeRole === "executivo") {
    return alerts.filter((a) => a.ownerUserId === session.userId);
  }
  if (scope.mode === "executive" && scope.executiveId) {
    return alerts.filter((a) => a.ownerUserId === scope.executiveId);
  }
  const allowed = new Set(visibleCollaborators(session).map((u) => u.id));
  return alerts.filter((a) => allowed.has(a.ownerUserId));
}

export function dismissAlert(id: string, ownerUserId: string): BrainAlert[] {
  const next = loadAlerts().map((a) =>
    a.id === id && a.ownerUserId === ownerUserId ? { ...a, dismissed: true } : a,
  );
  saveAlerts(next);
  return next;
}

export const PRIORITY_LABEL: Record<AlertPriority, string> = {
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};
