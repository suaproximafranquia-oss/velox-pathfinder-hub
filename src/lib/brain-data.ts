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

const ALERTS_KEY = "atlas:brain:alerts:v3";

/**
 * DEF 2.4.RESET — nenhum alerta de demonstração pode existir.
 * A base inicia vazia e só recebe alertas reais gerados pela operação.
 */
export function loadAlerts(): BrainAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as BrainAlert[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((a) => Boolean(a?.id && a?.ownerUserId));
  } catch {
    return [];
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
