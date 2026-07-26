/**
 * Relatórios Executivos — Atlas Platform
 *
 * Camada de agregação oficial da plataforma. Consome exclusivamente o
 * KPI Manager como fonte de indicadores e prepara a superfície estável
 * para Brain Analytics, exportações (PDF/Excel) e Inteligência Artificial.
 *
 * Regras arquiteturais:
 *  1. Nenhum indicador é inventado — todo dado vem de `loadDataset`.
 *  2. Nenhum valor pode ser preenchido manualmente por esta camada.
 *  3. A permissão do usuário sempre é respeitada (`canAccessKpiOf`).
 *  4. Alterações no KPI refletem imediatamente — não há cache paralelo.
 */
import {
  AVAILABLE_MONTHS,
  DEFAULT_MONTH_KEY,
  INDICATORS,
  averageRow,
  canAccessKpiOf,
  findMonth,
  formatCurrency,
  formatNumber,
  formatPercent,
  loadDataset,
  summarize,
  sumRow,
  type IndicatorId,
  type KpiDataset,
  type KpiMonth,
  type KpiSummary,
} from "./kpi-manager";
import type { ExecutiveSession } from "./executive-auth";
import { loadUsers, type ExecutiveUser } from "./executive-auth";
import { visibleCollaborators } from "./teams";

export type ReportScope = "individual" | "team";

export const REPORT_SCOPE_LABEL: Record<ReportScope, string> = {
  individual: "Individual",
  team: "Equipe",
};

export type ReportSelection = {
  scope: ReportScope;
  monthKey: string;
  /** Utilizado quando scope = "individual". */
  executiveId?: string;
};

export type ReportIndicator = {
  id: IndicatorId;
  label: string;
  unit: "count" | "currency";
  total: number;
  average: number;
  formatted: string;
  brainKey: string;
};

export type FunnelStage = { id: string; label: string; value: number };

export type ReportDataset = {
  selection: ReportSelection;
  month: KpiMonth;
  title: string;
  subtitle: string;
  sources: string[];
  summary: KpiSummary;
  indicators: ReportIndicator[];
  funnel: FunnelStage[];
  comparison: {
    label: string;
    current: number;
    previous: number;
    delta: number;
  }[];
  narrative: string;
  /** Marcador de rastreabilidade para IA. */
  provenance: {
    module: "KPI Manager";
    monthKey: string;
    generatedAt: number;
    executivesConsidered: string[];
  };
};

/* ---------------------- Descoberta de escopo ---------------------- */

export function availableScopes(session: ExecutiveSession): ReportScope[] {
  if (session.activeRole === "super_admin" || session.activeRole === "diretora")
    return ["team", "individual"];
  return ["individual"];
}

export function defaultSelection(session: ExecutiveSession): ReportSelection {
  const scope: ReportScope =
    session.activeRole === "super_admin" || session.activeRole === "diretora"
        ? "team"
        : "individual";
  return {
    scope,
    monthKey: DEFAULT_MONTH_KEY,
    executiveId: session.userId,
  };
}

export function availableExecutives(session: ExecutiveSession): ExecutiveUser[] {
  return visibleCollaborators(session);
}

/* ---------------------- Coleta de datasets ---------------------- */

function collectDatasets(
  session: ExecutiveSession,
  selection: ReportSelection,
): { users: ExecutiveUser[]; datasets: KpiDataset[] } {
  const managedIds = visibleCollaborators(session).map((u) => u.id);
  const all = loadUsers().filter((u) => u.status === "ativo");

  let users: ExecutiveUser[] = [];
  if (selection.scope === "individual") {
    const target = selection.executiveId ?? session.userId;
    if (!canAccessKpiOf(session, target, managedIds)) users = [];
    else users = all.filter((u) => u.id === target);
  } else {
    users = visibleCollaborators(session).filter((u) =>
      canAccessKpiOf(session, u.id, managedIds),
    );
  }

  const datasets = users.map((u) => loadDataset(u.id, selection.monthKey));
  return { users, datasets };
}

/* ---------------------- Agregações ---------------------- */

function aggregateMatrixTotal(
  datasets: KpiDataset[],
  indicator: IndicatorId,
): number {
  return datasets.reduce((acc, ds) => acc + sumRow(ds.matrix, indicator), 0);
}

function buildFunnel(summary: KpiSummary, datasets: KpiDataset[]): FunnelStage[] {
  void datasets;
  return [
    { id: "leads", label: "Leads", value: summary.leads },
    { id: "calls", label: "Ligações", value: summary.calls },
    { id: "presentations", label: "Apresentações", value: summary.presentations },
    { id: "cofs", label: "COFs", value: summary.contractsSent },
    { id: "sales", label: "Vendas", value: summary.sales },
  ];
}

function previousMonthKey(monthKey: string): string | null {
  const idx = AVAILABLE_MONTHS.findIndex((m) => m.key === monthKey);
  if (idx <= 0) return null;
  return AVAILABLE_MONTHS[idx - 1].key;
}

function buildComparison(
  session: ExecutiveSession,
  selection: ReportSelection,
  currentSummary: KpiSummary,
): ReportDataset["comparison"] {
  const prevKey = previousMonthKey(selection.monthKey);
  const prev: KpiSummary | null = prevKey
    ? summarizeMany(collectDatasets(session, { ...selection, monthKey: prevKey }).datasets)
    : null;
  const rows: [string, number, number][] = [
    ["Leads", currentSummary.leads, prev?.leads ?? 0],
    ["Apresentações", currentSummary.presentations, prev?.presentations ?? 0],
    ["COFs Enviadas", currentSummary.contractsSent, prev?.contractsSent ?? 0],
    ["Vendas", currentSummary.sales, prev?.sales ?? 0],
    ["Faturamento", currentSummary.salesValue, prev?.salesValue ?? 0],
  ];
  return rows.map(([label, current, previous]) => ({
    label,
    current,
    previous,
    delta: previous > 0 ? ((current - previous) / previous) * 100 : 0,
  }));
}

function summarizeMany(datasets: KpiDataset[]): KpiSummary {
  const merged: KpiSummary = {
    leads: 0,
    calls: 0,
    presentations: 0,
    contractsSent: 0,
    sales: 0,
    salesValue: 0,
    conversion: 0,
  };
  for (const ds of datasets) {
    const s = summarize(ds);
    merged.leads += s.leads;
    merged.calls += s.calls;
    merged.presentations += s.presentations;
    merged.contractsSent += s.contractsSent;
    merged.sales += s.sales;
    merged.salesValue += s.salesValue;
  }
  merged.conversion = merged.leads > 0 ? merged.sales / merged.leads : 0;
  return merged;
}

/* ---------------------- Resumo executivo (regras) ---------------------- */

function buildNarrative(
  scope: ReportScope,
  monthLabel: string,
  subjectName: string,
  summary: KpiSummary,
): string {
  const empty =
    summary.leads +
      summary.calls +
      summary.presentations +
      summary.contractsSent +
      summary.sales ===
    0;
  if (empty) {
    return `Não foram encontrados registros suficientes para ${subjectName} em ${monthLabel}. Assim que o KPI Manager receber lançamentos, o relatório será atualizado automaticamente.`;
  }
  const conv = formatPercent(summary.conversion);
  const val = formatCurrency(summary.salesValue);
  const prefix =
    scope === "individual"
      ? `Segundo os registros do KPI Manager, ${subjectName}`
      : `Com base nos dados oficiais do KPI Manager, a ${subjectName}`;
  return `${prefix} registrou ${formatNumber(summary.leads)} leads, ${formatNumber(summary.presentations)} apresentações, ${formatNumber(summary.contractsSent)} COFs enviadas, ${formatNumber(summary.sales)} vendas e ${val} em faturamento em ${monthLabel}. Conversão geral registrada: ${conv}.`;
}

/* ---------------------- API pública ---------------------- */

export function buildReport(
  session: ExecutiveSession,
  selection: ReportSelection,
): ReportDataset {
  const month = findMonth(selection.monthKey);
  const { users, datasets } = collectDatasets(session, selection);
  const summary = summarizeMany(datasets);

  const principalIds = new Set<IndicatorId>([
    "leads",
    "presentations",
    "contractsSent",
    "contractsSigned",
    "salesValue",
  ] as IndicatorId[]);
  const indicators: ReportIndicator[] = INDICATORS.filter((ind) =>
    principalIds.has(ind.id as IndicatorId),
  ).map((ind) => {
    const total = aggregateMatrixTotal(datasets, ind.id as IndicatorId);
    const average =
      datasets.length === 0
        ? 0
        : datasets.reduce(
            (a, ds) => a + averageRow(ds.matrix, ind.id, month),
            0,
          );
    return {
      id: ind.id as IndicatorId,
      label: ind.label,
      unit: ind.unit,
      total,
      average,
      formatted: ind.unit === "currency" ? formatCurrency(total) : formatNumber(total),
      brainKey: ind.brainKey,
    };
  });

  const subjectName =
    selection.scope === "individual"
      ? users[0]?.name ?? "este executivo"
      : "Equipe";

  const title =
    selection.scope === "individual"
      ? `Relatório Individual — ${subjectName}`
      : "Relatório de Equipe";

  return {
    selection,
    month,
    title,
    subtitle: `Competência ${month.label}`,
    sources: ["KPI Manager"],
    summary,
    indicators,
    funnel: buildFunnel(summary, datasets),
    comparison: buildComparison(session, selection, summary),
    narrative: buildNarrative(selection.scope, month.label, subjectName, summary),
    provenance: {
      module: "KPI Manager",
      monthKey: month.key,
      generatedAt: Date.now(),
      executivesConsidered: users.map((u) => u.id),
    },
  };
}

/* ---------------------- Preparação de exportação ---------------------- */

export type ExportFormat = "pdf" | "excel" | "share";

export const EXPORT_LABEL: Record<ExportFormat, string> = {
  pdf: "Exportar PDF",
  excel: "Exportar Excel",
  share: "Compartilhar",
};

/**
 * Interface reservada para a próxima Sprint. A implementação definitiva
 * usará jsPDF/SheetJS e a Web Share API. Nesta versão apenas registra
 * intenção — nenhum arquivo é gerado.
 */
export function requestExport(_report: ReportDataset, _format: ExportFormat): {
  status: "prepared";
  format: ExportFormat;
  scheduledFor: "next-sprint";
} {
  return { status: "prepared", format: _format, scheduledFor: "next-sprint" };
}

/* ---------------------- Preparação Brain Analytics ---------------------- */

/**
 * Contrato estável consumido pelo Brain quando este for religado à fonte
 * oficial. Alimenta os mesmos indicadores exibidos aqui, sem duplicar
 * regras de negócio.
 */
export type BrainReportBridge = {
  monthKey: string;
  scope: ReportScope;
  totals: Record<string, number>;
  updatedAt: number;
};

export function toBrainBridge(report: ReportDataset): BrainReportBridge {
  const totals: Record<string, number> = {};
  for (const ind of report.indicators) totals[ind.brainKey] = ind.total;
  return {
    monthKey: report.month.key,
    scope: report.selection.scope,
    totals,
    updatedAt: report.provenance.generatedAt,
  };
}

/* ---------------------- Governança da IA (preparação) ---------------------- */

/**
 * Regras oficiais da Inteligência Artificial da Atlas Platform.
 * Nesta Sprint apenas estruturamos as diretrizes; a implementação
 * conversacional será plugada nas próximas Sprints consumindo
 * exclusivamente `buildReport` e módulos oficiais equivalentes.
 */
export const AI_GOVERNANCE = {
  version: 1,
  role: "Analista de Negócios corporativo da Atlas Platform.",
  principles: [
    "Nunca inventar informações, números ou tendências.",
    "Nunca completar respostas com suposições.",
    "Nunca misturar conhecimento externo com dados internos do workspace.",
    "Sempre responder exclusivamente com base nos módulos oficiais.",
    "Sempre indicar a origem da informação utilizada.",
    "Quando faltarem dados, informar isso de forma explícita.",
    "Nunca ampliar permissões do usuário autenticado.",
    "Sempre sinalizar interpretações com linguagem transparente.",
  ],
  officialSources: [
    "KPI Manager",
    "CRM",
    "Agenda",
    "Pipeline",
    "Relatórios",
    "Brain Analytics",
  ],
  fallbackMessages: {
    empty: "Não existem dados suficientes para responder essa solicitação.",
    noPeriod: "Não foram encontrados registros para o período informado.",
    conflict:
      "Foram encontradas inconsistências entre módulos oficiais. Recomenda-se conferência dos dados antes de qualquer decisão.",
  },
} as const;

export type AiContext = {
  session: ExecutiveSession;
  selection: ReportSelection;
  report: ReportDataset;
};

/**
 * Monta o contexto de rastreabilidade que a IA deverá anexar a cada
 * resposta. Assinatura estável — implementação conversacional futura.
 */
export function buildAiContext(
  session: ExecutiveSession,
  selection: ReportSelection,
): AiContext {
  const report = buildReport(session, selection);
  return { session, selection, report };
}

/**
 * Autoriza (ou não) uma consulta da IA respeitando integralmente as
 * permissões do usuário autenticado — nunca ampliando escopo.
 */
export function aiCanAnswer(
  session: ExecutiveSession,
  selection: ReportSelection,
): boolean {
  const scopes = availableScopes(session);
  return scopes.includes(selection.scope);
}

export { AVAILABLE_MONTHS };
