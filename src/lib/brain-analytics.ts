/**
 * Brain Analytics — camada analítica estratégica.
 *
 * Princípio (Prompt 6E): o Brain existe para APOIAR DECISÃO.
 * Não repete indicadores já exibidos no topo da página, não exibe séries
 * diárias nem distribuição de origem. Entrega: funil, conversões,
 * comparativo executivo (atual · mês anterior · média anual) e insights
 * que interpretam os dados.
 *
 * Todos os números vêm do KPI Manager — nada é inventado nesta camada.
 */
import type { ScopeSelection } from "./brain/scopes";
import type { ExecutiveSession } from "./executive-auth";
import {
  AVAILABLE_MONTHS,
  findMonth,
  loadDataset,
  summarize,
  sumRow,
} from "./kpi-manager";
import { visibleCollaborators } from "./teams";

export type ConversionRate = {
  id: string;
  label: string;
  from: number;
  to: number;
  rate: number;
  hint: string;
};

export type ComparisonRow = {
  id: string;
  label: string;
  unit: "count" | "currency";
  current: number;
  previous: number;
  annualAverage: number;
  vsPrevious: number | null;
  vsAnnual: number | null;
};

export type ComparisonReport = {
  previousLabel: string;
  annualLabel: string;
  rows: ComparisonRow[];
  hasPrevious: boolean;
};

export type BrainInsight = {
  id: string;
  tone: "positivo" | "atencao" | "neutro";
  title: string;
  detail: string;
};

type Totals = {
  leads: number;
  presentations: number;
  videosDone: number;
  contractsSent: number;
  sales: number;
  salesValue: number;
};

export type BrainAnalytics = {
  subjectLabel: string;
  monthLabel: string;
  headline: string;
  conversions: ConversionRate[];
  comparison: ComparisonReport;
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

function emptyTotals(): Totals {
  return {
    leads: 0,
    presentations: 0,
    videosDone: 0,
    contractsSent: 0,
    sales: 0,
    salesValue: 0,
  };
}

function totalsFor(userIds: string[], monthKey: string): Totals {
  return userIds.reduce((acc, id) => {
    const ds = loadDataset(id, monthKey);
    const s = summarize(ds);
    acc.leads += s.leads;
    acc.presentations += s.presentations;
    acc.contractsSent += s.contractsSent;
    acc.sales += s.sales;
    acc.salesValue += s.salesValue;
    acc.videosDone += sumRow(ds.matrix, "videosDone");
    return acc;
  }, emptyTotals());
}

function conversionsFrom(t: Totals): ConversionRate[] {
  return [
    {
      id: "lead_apres",
      label: "Lead → Apresentação",
      from: t.leads,
      to: t.presentations,
      rate: t.leads > 0 ? t.presentations / t.leads : 0,
      hint: "Capacidade de transformar contato em conversa consultiva.",
    },
    {
      id: "apres_cof",
      label: "Apresentação → COF",
      from: t.presentations,
      to: t.contractsSent,
      rate: t.presentations > 0 ? t.contractsSent / t.presentations : 0,
      hint: "Maturidade das conversas até a proposta formal.",
    },
    {
      id: "cof_venda",
      label: "COF → Venda",
      from: t.contractsSent,
      to: t.sales,
      rate: t.contractsSent > 0 ? t.sales / t.contractsSent : 0,
      hint: "Eficiência de fechamento das propostas enviadas.",
    },
    {
      id: "lead_venda",
      label: "Lead → Venda",
      from: t.leads,
      to: t.sales,
      rate: t.leads > 0 ? t.sales / t.leads : 0,
      hint: "Conversão total da esteira comercial.",
    },
  ];
}

const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);

const variation = (current: number, reference: number): number | null =>
  reference > 0 ? (current - reference) / reference : null;

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
      ? (collaborators.find((u) => u.id === (scope.executiveId ?? session.userId))?.name ??
        session.name)
      : "Equipe consolidada";

  const totals = totalsFor(userIds, monthKey);

  const idx = AVAILABLE_MONTHS.findIndex((m) => m.key === monthKey);
  const prevMonth = idx > 0 ? AVAILABLE_MONTHS[idx - 1] : null;
  const prevTotals = prevMonth ? totalsFor(userIds, prevMonth.key) : emptyTotals();

  const yearMonths = AVAILABLE_MONTHS.filter((m) => m.year === month.year);
  const yearAcc = yearMonths.reduce((acc, m) => {
    const t = totalsFor(userIds, m.key);
    acc.leads += t.leads;
    acc.presentations += t.presentations;
    acc.videosDone += t.videosDone;
    acc.contractsSent += t.contractsSent;
    acc.sales += t.sales;
    acc.salesValue += t.salesValue;
    return acc;
  }, emptyTotals());
  const divisor = Math.max(yearMonths.length, 1);
  const annualAvg: Totals = {
    leads: yearAcc.leads / divisor,
    presentations: yearAcc.presentations / divisor,
    videosDone: yearAcc.videosDone / divisor,
    contractsSent: yearAcc.contractsSent / divisor,
    sales: yearAcc.sales / divisor,
    salesValue: yearAcc.salesValue / divisor,
  };

  const rowDefs: { id: keyof Totals; label: string; unit: "count" | "currency" }[] = [
    { id: "leads", label: "Leads", unit: "count" },
    { id: "presentations", label: "Apresentações", unit: "count" },
    { id: "contractsSent", label: "COFs enviadas", unit: "count" },
    { id: "sales", label: "Vendas", unit: "count" },
    { id: "salesValue", label: "Faturamento", unit: "currency" },
  ];

  const comparison: ComparisonReport = {
    previousLabel: prevMonth ? prevMonth.label : "Sem competência anterior",
    annualLabel: `Média ${month.year}`,
    hasPrevious: !!prevMonth,
    rows: rowDefs.map((d) => ({
      id: d.id,
      label: d.label,
      unit: d.unit,
      current: totals[d.id],
      previous: prevTotals[d.id],
      annualAverage: annualAvg[d.id],
      vsPrevious: variation(totals[d.id], prevTotals[d.id]),
      vsAnnual: variation(totals[d.id], annualAvg[d.id]),
    })),
  };

  const conversions = conversionsFrom(totals);
  const prevConversions = conversionsFrom(prevTotals);

  // ---------------- Insights: interpretação, nunca repetição -----------------
  const insights: BrainInsight[] = [];

  const finalRate = conversions[3].rate;
  const prevFinalRate = prevConversions[3].rate;
  if (prevMonth && prevFinalRate > 0) {
    const diff = finalRate - prevFinalRate;
    insights.push({
      id: "conv_vs_prev",
      tone: diff >= 0 ? "positivo" : "atencao",
      title:
        diff >= 0
          ? `Conversão comercial superior a ${prevMonth.label}`
          : `Retração na conversão comercial frente a ${prevMonth.label}`,
      detail:
        `A esteira converte ${pct(finalRate)} de Lead em Venda contra ${pct(prevFinalRate)} na competência anterior. ` +
        (diff >= 0
          ? "O ganho indica melhora na qualificação ou na cadência de fechamento — vale replicar a prática atual."
          : "A queda sugere perda de tração entre a captação e o fechamento — revisar qualificação e follow-up."),
    });
  }

  // Maior perda do funil.
  const stages: { label: string; value: number }[] = [
    { label: "Leads", value: totals.leads },
    { label: "Apresentações", value: totals.presentations },
    { label: "Videoconferências", value: totals.videosDone },
    { label: "COFs enviadas", value: totals.contractsSent },
    { label: "Vendas", value: totals.sales },
  ];
  let worst: { from: string; to: string; kept: number } | null = null;
  for (let i = 1; i < stages.length; i += 1) {
    const from = stages[i - 1];
    const to = stages[i];
    if (from.value <= 0) continue;
    const kept = to.value / from.value;
    if (!worst || kept < worst.kept) worst = { from: from.label, to: to.label, kept };
  }
  if (worst) {
    insights.push({
      id: "gargalo",
      tone: worst.kept < 0.35 ? "atencao" : "neutro",
      title: `Maior gargalo entre ${worst.from} e ${worst.to}`,
      detail:
        `Apenas ${pct(worst.kept)} do volume avança nesta transição — é o ponto de maior perda do funil ` +
        `e onde uma ação corretiva gera o maior impacto imediato no resultado.`,
    });
  }

  // Melhor indicador operacional frente à média anual.
  const bestRow = comparison.rows
    .filter((r) => r.vsAnnual !== null)
    .sort((a, b) => (b.vsAnnual ?? 0) - (a.vsAnnual ?? 0))[0];
  if (bestRow && (bestRow.vsAnnual ?? 0) > 0) {
    insights.push({
      id: "acima_media",
      tone: "positivo",
      title: `${bestRow.label} acima da média anual`,
      detail:
        `O desempenho está ${pct(bestRow.vsAnnual ?? 0)} acima da média de ${month.year}, ` +
        `sendo o indicador de melhor performance relativa do período.`,
    });
  }
  const weakRow = comparison.rows
    .filter((r) => r.vsAnnual !== null)
    .sort((a, b) => (a.vsAnnual ?? 0) - (b.vsAnnual ?? 0))[0];
  if (weakRow && (weakRow.vsAnnual ?? 0) < 0) {
    insights.push({
      id: "abaixo_media",
      tone: "atencao",
      title: `${weakRow.label} abaixo da média anual`,
      detail:
        `Queda de ${pct(Math.abs(weakRow.vsAnnual ?? 0))} em relação à média de ${month.year}. ` +
        `Priorizar este indicador na próxima semana comercial evita impacto no fechamento do trimestre.`,
    });
  }

  // Fechamento das propostas.
  const cofRate = conversions[2].rate;
  const prevCofRate = prevConversions[2].rate;
  insights.push({
    id: "fechamento",
    tone: cofRate >= 0.4 ? "positivo" : "atencao",
    title:
      cofRate >= prevCofRate
        ? `Taxa de fechamento de propostas em ${pct(cofRate)}`
        : `Redução da taxa de fechamento para ${pct(cofRate)}`,
    detail:
      cofRate >= 0.4
        ? "As COFs enviadas estão sendo apresentadas no momento certo da conversa — manter o padrão de proposta."
        : "Há propostas formais sem desfecho: retomar as COFs em aberto é a ação de maior retorno no curto prazo.",
  });

  if (insights.length === 0) {
    insights.push({
      id: "sem_base",
      tone: "neutro",
      title: "Base insuficiente para leitura estratégica",
      detail: "Registre os indicadores no KPI Manager para habilitar a análise automática do período.",
    });
  }

  const headline =
    `Em ${month.label}, ${subjectLabel.toLowerCase()} converteu ${pct(finalRate)} dos leads em vendas, ` +
    `com ${totals.sales} fechamentos e ${brl(totals.salesValue)} de faturamento.`;

  const revVsPrev = comparison.rows.find((r) => r.id === "salesValue")?.vsPrevious ?? null;
  const closing =
    `Leitura de ${month.label}: ` +
    (revVsPrev === null
      ? "não há competência anterior para comparação de faturamento. "
      : `faturamento ${revVsPrev >= 0 ? "acima" : "abaixo"} da competência anterior em ${pct(Math.abs(revVsPrev))}. `) +
    (worst
      ? `O ponto de atenção permanece na transição ${worst.from} → ${worst.to}.`
      : "Sem gargalo relevante identificado no funil.");

  return {
    subjectLabel,
    monthLabel: month.label,
    headline,
    conversions,
    comparison,
    insights,
    closing,
  };
}
