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
  const videosDone = datasets.reduce(
    (acc, ds) => acc + sumRow(ds.matrix, "videosDone"),
    0,
  );
  return [
    { id: "leads", label: "Lead", value: summary.leads },
    { id: "presentations", label: "Apresentação", value: summary.presentations },
    { id: "videos", label: "Videoconferência", value: videosDone },
    { id: "cofs", label: "COF enviada", value: summary.contractsSent },
    { id: "sales", label: "Venda", value: summary.sales },
    { id: "revenue", label: "Faturamento", value: summary.salesValue },
  ];
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

export type ExportFormat = "pdf" | "excel";

export const EXPORT_LABEL: Record<ExportFormat, string> = {
  pdf: "Exportar PDF",
  excel: "Exportar Excel",
};

/**
 * Gera um resumo automatizado, no estilo "Análise Brain", a partir do
 * relatório oficial. Segue a governança da IA: nenhum dado é inventado
 * e a linguagem é interpretativa, nunca prescritiva.
 */
export function brainSummaryFromReport(report: ReportDataset): string {
  const s = report.summary;
  const empty = s.leads + s.presentations + s.contractsSent + s.sales === 0;
  if (empty) {
    return `Nenhum registro operacional foi localizado para ${report.month.label}. A análise será atualizada assim que o KPI Manager receber lançamentos.`;
  }
  const conv = formatPercent(s.conversion);
  const pres = s.leads > 0 ? formatPercent(s.presentations / s.leads) : "sem base";
  const cofs = s.presentations > 0 ? formatPercent(s.contractsSent / s.presentations) : "sem base";
  const closing = s.contractsSent > 0 ? formatPercent(s.sales / s.contractsSent) : "sem base";
  const ticket = s.sales > 0 ? formatCurrency(s.salesValue / s.sales) : "n/d";
  return (
    `Análise operacional de ${report.month.label}: dos ${formatNumber(s.leads)} leads captados, ` +
    `${pres} avançaram para apresentação, ${cofs} evoluíram para COF enviada e ${closing} converteram em venda ` +
    `(conversão final ${conv}). Ticket médio ${ticket}. Faturamento consolidado ${formatCurrency(s.salesValue)}. ` +
    `Interpretação automática — não substitui análise humana.`
  );
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
