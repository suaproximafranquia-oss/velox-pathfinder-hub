/**
 * Brain Analytics — camada analítica consolidada.
 *
 * Incorpora definitivamente o conteúdo executivo que existia na antiga
 * experiência de "Relatórios" (removida): evolução operacional, gráficos
 * históricos, comparativos, distribuição dos Leads, conversões,
 * tendências e insights automáticos.
 *
 * Todos os números vêm do KPI Manager e da base real de investidores —
 * nenhuma métrica é inventada nesta camada.
 */
import type { ScopeSelection } from "./brain/scopes";
import type { ExecutiveSession } from "./executive-auth";
import {
  AVAILABLE_MONTHS,
  daysInMonth,
  findMonth,
  loadDataset,
  summarize,
  sumRow,
} from "./kpi-manager";
import { visibleCollaborators } from "./teams";
import { listAllInvestors } from "./executive-data";
import { resolveLeadState, LEAD_STATE_META, type LeadState } from "./lead-state";
import { buildComparative, narrativeFromComparative, type ComparativeReport } from "./report-comparatives";
import type { SeriesPoint } from "./brain-data";

export type ConversionRate = {
  id: string;
  label: string;
  from: number;
  to: number;
  rate: number;
  hint: string;
};

export type DistributionSlice = {
  id: string;
  label: string;
  value: number;
  tone: string;
};

export type BrainInsight = {
  id: string;
  tone: "positivo" | "atencao" | "neutro";
  title: string;
  detail: string;
};

export type BrainAnalytics = {
  subjectLabel: string;
  monthLabel: string;
  headline: string;
  series: { leads: SeriesPoint[]; sales: SeriesPoint[]; revenue: SeriesPoint[] };
  evolution: SeriesPoint[];
  conversions: ConversionRate[];
  leadStates: DistributionSlice[];
  leadOrigins: DistributionSlice[];
  comparative: ComparativeReport;
  comparativeNarrative: string;
  insights: BrainInsight[];
  closing: string;
};

function scopeUserIds(session: ExecutiveSession, scope: ScopeSelection): string[] {
  const collaborators = visibleCollaborators(session);
  if (scope.mode === "executive") {
    const id = scope.executiveId ?? session.userId;
    return collaborators.filter((u) => u.id === id).map((u) => u.id);
  }
  return collaborators.map((u) => u.id);
}

function dailySeries(userIds: string[], monthKey: string, indicatorId: string): SeriesPoint[] {
  const month = findMonth(monthKey);
  const total = daysInMonth(month);
  const datasets = userIds.map((id) => loadDataset(id, monthKey));
  const points: SeriesPoint[] = [];
  for (let day = 1; day <= total; day += 1) {
    let value = 0;
    for (const ds of datasets) value += ds.matrix[indicatorId]?.[day] ?? 0;
    points.push({ x: String(day).padStart(2, "0"), y: Math.round(value) });
  }
  return points;
}

function monthlyEvolution(userIds: string[]): SeriesPoint[] {
  return AVAILABLE_MONTHS.map((m) => {
    let value = 0;
    for (const id of userIds) value += summarize(loadDataset(id, m.key)).sales;
    return { x: m.label.slice(0, 3), y: Math.round(value) };
  });
}

const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

export function buildBrainAnalytics(
  session: ExecutiveSession,
  scope: ScopeSelection,
  monthKey: string,
): BrainAnalytics {
  const userIds = scopeUserIds(session, scope);
  const month = findMonth(monthKey);
  const collaborators = visibleCollaborators(session);
  const subjectLabel =
    scope.mode === "executive"
      ? collaborators.find((u) => u.id === (scope.executiveId ?? session.userId))?.name ?? session.name
      : "Equipe consolidada";

  const totals = userIds.reduce(
    (acc, id) => {
      const ds = loadDataset(id, monthKey);
      const s = summarize(ds);
      acc.leads += s.leads;
      acc.presentations += s.presentations;
      acc.contractsSent += s.contractsSent;
      acc.sales += s.sales;
      acc.salesValue += s.salesValue;
      acc.videosDone += sumRow(ds.matrix, "videosDone");
      return acc;
    },
    { leads: 0, presentations: 0, contractsSent: 0, sales: 0, salesValue: 0, videosDone: 0 },
  );

  const conversions: ConversionRate[] = [
    {
      id: "lead_apres",
      label: "Lead → Apresentação",
      from: totals.leads,
      to: totals.presentations,
      rate: totals.leads > 0 ? totals.presentations / totals.leads : 0,
      hint: "Capacidade de transformar contato em conversa consultiva.",
    },
    {
      id: "apres_cof",
      label: "Apresentação → COF",
      from: totals.presentations,
      to: totals.contractsSent,
      rate: totals.presentations > 0 ? totals.contractsSent / totals.presentations : 0,
      hint: "Maturidade das conversas até a proposta formal.",
    },
    {
      id: "cof_venda",
      label: "COF → Venda",
      from: totals.contractsSent,
      to: totals.sales,
      rate: totals.contractsSent > 0 ? totals.sales / totals.contractsSent : 0,
      hint: "Eficiência de fechamento das propostas enviadas.",
    },
    {
      id: "lead_venda",
      label: "Lead → Venda",
      from: totals.leads,
      to: totals.sales,
      rate: totals.leads > 0 ? totals.sales / totals.leads : 0,
      hint: "Conversão total da esteira comercial.",
    },
  ];

  // Distribuição real dos Leads da carteira em escopo.
  const owned = new Set(userIds);
  const investors = listAllInvestors().filter((i) => owned.has(i.assignedToUserId));
  const stateCount: Record<LeadState, number> = { novo: 0, em_andamento: 0, encerrado: 0 };
  const originCount: Record<string, number> = { green_sales: 0, portal: 0, manual: 0 };
  for (const inv of investors) {
    stateCount[resolveLeadState(inv)] += 1;
    originCount[inv.origin ?? "manual"] += 1;
  }

  const leadStates: DistributionSlice[] = (
    ["novo", "em_andamento", "encerrado"] as LeadState[]
  ).map((s) => ({
    id: s,
    label: LEAD_STATE_META[s].label,
    value: stateCount[s],
    tone: LEAD_STATE_META[s].dot,
  }));

  const leadOrigins: DistributionSlice[] = [
    { id: "green_sales", label: "Green Sales", value: originCount.green_sales, tone: "bg-emerald-500" },
    { id: "portal", label: "Portal Velox", value: originCount.portal, tone: "bg-sky-500" },
    { id: "manual", label: "Cadastro manual", value: originCount.manual, tone: "bg-violet-500" },
  ];

  const comparative = buildComparative(userIds, monthKey, "previous");
  const comparativeNarrative = narrativeFromComparative(subjectLabel, comparative);

  const insights: BrainInsight[] = [];
  const finalRate = conversions[3].rate;
  insights.push({
    id: "conversao",
    tone: finalRate >= 0.08 ? "positivo" : finalRate > 0 ? "atencao" : "neutro",
    title: `Conversão total de ${pct(finalRate)} entre Lead e Venda`,
    detail:
      finalRate >= 0.08
        ? "A esteira comercial está saudável: o volume captado tem se convertido em fechamento com consistência."
        : "A esteira apresenta perda de tração entre a captação e o fechamento — revisar qualificação e cadência de follow-up.",
  });
  const cofRate = conversions[2].rate;
  insights.push({
    id: "cof",
    tone: cofRate >= 0.4 ? "positivo" : "atencao",
    title: `${pct(cofRate)} das COFs enviadas viraram venda`,
    detail:
      cofRate >= 0.4
        ? "O material formal está bem posicionado no momento certo da conversa."
        : "Há propostas formais sem desfecho — priorizar retomada das COFs em aberto.",
  });
  const revCell = comparative.cells.find((c) => c.unit === "currency");
  if (revCell) {
    insights.push({
      id: "faturamento",
      tone: revCell.delta >= 0 ? "positivo" : "atencao",
      title:
        revCell.delta >= 0
          ? `Faturamento ${brl(Math.abs(revCell.delta))} acima da competência anterior`
          : `Faturamento ${brl(Math.abs(revCell.delta))} abaixo da competência anterior`,
      detail: comparative.hint,
    });
  }
  insights.push({
    id: "carteira",
    tone: stateCount.novo > 0 ? "atencao" : "positivo",
    title:
      stateCount.novo > 0
        ? `${stateCount.novo} Lead(s) com atualização ainda não visualizada`
        : "Nenhum Lead aguardando primeira visualização",
    detail:
      stateCount.novo > 0
        ? "Indicadores verdes no Workspace representam movimentações recentes que ainda não foram abertas."
        : "Toda a carteira em escopo já foi visualizada e está em acompanhamento.",
  });

  const headline =
    `Em ${month.label}, ${subjectLabel.toLowerCase()} registrou ${totals.leads} leads, ` +
    `${totals.presentations} apresentações, ${totals.videosDone} videoconferências, ` +
    `${totals.contractsSent} COFs e ${totals.sales} vendas, totalizando ${brl(totals.salesValue)}.`;

  const closing =
    `Consolidação de ${month.label}: conversão total de ${pct(finalRate)}, ` +
    `${investors.length} investidores acompanhados e ${stateCount.em_andamento} oportunidades em andamento. ` +
    `${comparativeNarrative}`;

  return {
    subjectLabel,
    monthLabel: month.label,
    headline,
    series: {
      leads: dailySeries(userIds, monthKey, "leads"),
      sales: dailySeries(userIds, monthKey, "contractsSigned"),
      revenue: dailySeries(userIds, monthKey, "salesValue"),
    },
    evolution: monthlyEvolution(userIds),
    conversions,
    leadStates,
    leadOrigins,
    comparative,
    comparativeNarrative,
    insights,
    closing,
  };
}
