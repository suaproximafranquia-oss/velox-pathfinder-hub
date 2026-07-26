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

export type BrainPeriod = 7 | 14 | 30 | 90;

export const PERIOD_OPTIONS: { value: BrainPeriod; label: string }[] = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

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
  period: BrainPeriod;
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
      return acc;
    },
    {
      leads: 0,
      calls: 0,
      presentations: 0,
      contractsSent: 0,
      sales: 0,
      salesValue: 0,
    },
  );
}

function buildOperationalFunnel(totals: ReturnType<typeof summarizeMany>): FunnelStage[] {
  return [
    { id: "leads", label: "Leads", value: totals.leads },
    { id: "calls", label: "Ligações", value: totals.calls },
    { id: "presentations", label: "Apresentações", value: totals.presentations },
    { id: "cofs", label: "COFs", value: totals.contractsSent },
    { id: "sales", label: "Vendas", value: totals.sales },
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
  const videosDone = datasets.reduce(
    (acc, ds) => acc + sumRow(ds.matrix, "videosDone"),
    0,
  );

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
    {
      id: "videos",
      label: "Vídeo Conferências",
      value: fmtInt(videosDone),
      delta: 0,
      description: "Reuniões realizadas",
      tooltip: "Vídeo conferências feitas no período.",
      icon: "video",
    },
  ];

  return {
    period: 30,
    scope,
    kpis,
    funnel: buildOperationalFunnel(totals),
  };
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function scopeMultiplier(scope: ScopeSelection): number {
  switch (scope.mode) {
    case "company":
      return 1;
    case "team":
      return 0.55;
    case "executive":
      return 0.18;
    case "personal":
      return 0.15;
    case "comparison":
      return 0.6;
  }
}

/**
 * Snapshot simulado. A assinatura (period, scope) e a superficie
 * estavel para a futura fonte real de dados.
 */
export function buildSnapshot(
  period: BrainPeriod,
  scope: ScopeSelection,
): BrainSnapshot {
  const rnd = seeded(period * 137 + scope.mode.length * 31);
  const scale = (period / 30) * scopeMultiplier(scope);

  const novos = Math.round(140 * scale + rnd() * 40);
  const oportunidades = Math.round(novos * 0.62);
  const videos = Math.round(oportunidades * 0.55);
  const cofs = Math.round(videos * 0.48);
  const contratos = Math.round(cofs * 0.7);
  const vendas = Math.round(contratos * 0.82);
  const conv = (vendas / Math.max(novos, 1)) * 100;
  const tempoDias = 12 + rnd() * 8;

  const kpis: BrainKpi[] = [
    {
      id: "novos",
      label: "Novos Investidores",
      value: fmtInt(novos),
      delta: 6.4,
      description: "Entradas no periodo",
      tooltip: "Registros novos recebidos no periodo selecionado.",
      icon: "users",
    },
    {
      id: "oport",
      label: "Oportunidades",
      value: fmtInt(oportunidades),
      delta: 4.1,
      description: "Qualificacao positiva",
      tooltip: "Registros qualificados como oportunidades ativas.",
      icon: "sparkles",
    },
    {
      id: "video",
      label: "Video Chamadas",
      value: fmtInt(videos),
      delta: 2.8,
      description: "Reunioes realizadas",
      tooltip: "Encontros consultivos concluidos.",
      icon: "video",
    },
    {
      id: "cof",
      label: "COFs Enviadas",
      value: fmtInt(cofs),
      delta: -1.2,
      description: "Propostas ativas",
      tooltip: "Confirmacoes formais de oferta enviadas.",
      icon: "fileCheck",
    },
    {
      id: "contratos",
      label: "Contratos",
      value: fmtInt(contratos),
      delta: 3.6,
      description: "Assinaturas em curso",
      tooltip: "Contratos gerados a partir das COFs enviadas.",
      icon: "handshake",
    },
    {
      id: "vendas",
      label: "Vendas",
      value: fmtInt(vendas),
      delta: 5.9,
      description: "Fechamentos concluidos",
      tooltip: "Contratos convertidos em venda efetiva.",
      icon: "trophy",
    },
    {
      id: "conv",
      label: "Conversao Geral",
      value: fmtPct(conv),
      delta: 0.8,
      description: "Do primeiro contato a venda",
      tooltip: "Percentual de conversao ao longo do funil completo.",
      icon: "activity",
    },
    {
      id: "tempo",
      label: "Tempo Medio de Evolucao",
      value: `${tempoDias.toFixed(1)} d`,
      delta: -1.4,
      description: "Ciclo medio da jornada",
      tooltip: "Tempo medio entre primeiro contato e fechamento.",
      icon: "clock",
    },
  ];

  const funnel: FunnelStage[] = [
    { id: "novo", label: "Novo", value: novos },
    { id: "contato", label: "Primeiro Contato", value: Math.round(novos * 0.78) },
    { id: "oport", label: "Oportunidade", value: oportunidades },
    { id: "video", label: "Video", value: videos },
    { id: "cof", label: "COF", value: cofs },
    { id: "venda", label: "Venda", value: vendas },
  ];

  const days = period;
  const temporal: SeriesPoint[] = Array.from({ length: days }).map((_, i) => {
    const base = 6 + rnd() * 8;
    const wave = Math.sin(i / 3) * 3;
    return { x: `D-${days - i}`, y: Math.max(1, Math.round(base + wave)) };
  });

  let acc = 0;
  const evolution: SeriesPoint[] = temporal.map((p) => {
    acc += p.y;
    return { x: p.x, y: acc };
  });

  const trend: SeriesPoint[] = temporal.map((p, i) => ({
    x: p.x,
    y: Math.round(p.y * (1 + i / (days * 2))),
  }));

  void temporal;
  void evolution;
  void trend;
  return { period, scope, kpis, funnel };
}

// ---------- Alertas persistentes ----------

export type AlertPriority = "alta" | "media" | "baixa";

export type AlertCategory =
  | "contato"
  | "followup"
  | "portal"
  | "contrato"
  | "reuniao"
  | "oportunidade";

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  contato: "Contato",
  followup: "Follow-up",
  portal: "Portal",
  contrato: "Contrato",
  reuniao: "Reuniao",
  oportunidade: "Oportunidade",
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
    title: "Voce possui 12 novos investidores aguardando contato",
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
    title: "Existem 5 follow-ups programados para hoje",
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
    title: "Um investidor retornou recentemente ao Portal",
    description:
      "Retomada de leitura detectada — momento oportuno para reengajamento.",
    priority: "baixa",
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    copyTemplate:
      "Ola. Percebi que voce voltou recentemente ao nosso Portal. Caso ainda tenha interesse em continuar sua jornada, fico a disposicao.",
  },
  {
    id: "alert_contratos",
    ownerUserId: "usr_milton",
    category: "contrato",
    title: "Existem contratos aguardando retorno",
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
    title: "Existe uma videoconferencia agendada",
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
    title: "Oportunidades sem atualizacao ha mais de sete dias",
    description:
      "Registros parados na esteira consultiva sem novas interacoes.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    copyTemplate:
      "Ola. Notei que faz alguns dias desde nossa ultima conversa. Posso te ajudar com alguma pendencia?",
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
