/**
 * Comparativos oficiais do módulo Relatórios.
 *
 * Consome exclusivamente `loadDataset` do KPI Manager — nenhuma métrica
 * é inventada. Fornece três eixos de comparação, todos rastreáveis:
 *   1. vs. Média anual  — média das competências disponíveis do próprio alvo.
 *   2. vs. Mês anterior — competência imediatamente anterior do próprio alvo.
 *   3. vs. Histórico    — total acumulado no período disponível.
 */
import {
  AVAILABLE_MONTHS,
  findMonth,
  loadDataset,
  summarize,
  type KpiSummary,
} from "./kpi-manager";

export type ComparativeAxis = "annual" | "previous" | "historical";

export type ComparativeCell = {
  label: string;
  value: number;
  reference: number;
  delta: number;
  deltaPercent: number | null;
  unit: "count" | "currency";
};

export type ComparativeReport = {
  axis: ComparativeAxis;
  axisLabel: string;
  hint: string;
  cells: ComparativeCell[];
  hasReference: boolean;
};

const AXIS_LABEL: Record<ComparativeAxis, string> = {
  annual: "vs. Média anual",
  previous: "vs. Mês anterior",
  historical: "vs. Histórico pessoal",
};

function sumSummary(a: KpiSummary, b: KpiSummary): KpiSummary {
  return {
    leads: a.leads + b.leads,
    calls: a.calls + b.calls,
    presentations: a.presentations + b.presentations,
    contractsSent: a.contractsSent + b.contractsSent,
    sales: a.sales + b.sales,
    salesValue: a.salesValue + b.salesValue,
    conversion: 0,
  };
}

function scaleSummary(s: KpiSummary, factor: number): KpiSummary {
  return {
    leads: s.leads * factor,
    calls: s.calls * factor,
    presentations: s.presentations * factor,
    contractsSent: s.contractsSent * factor,
    sales: s.sales * factor,
    salesValue: s.salesValue * factor,
    conversion: 0,
  };
}

function loadSubjectSummary(userIds: string[], monthKey: string): KpiSummary {
  const acc: KpiSummary = {
    leads: 0, calls: 0, presentations: 0, contractsSent: 0,
    sales: 0, salesValue: 0, conversion: 0,
  };
  for (const id of userIds) {
    const ds = loadDataset(id, monthKey);
    const s = summarize(ds);
    acc.leads += s.leads;
    acc.calls += s.calls;
    acc.presentations += s.presentations;
    acc.contractsSent += s.contractsSent;
    acc.sales += s.sales;
    acc.salesValue += s.salesValue;
  }
  return acc;
}

function buildCells(current: KpiSummary, reference: KpiSummary): ComparativeCell[] {
  const pairs: [string, keyof KpiSummary, "count" | "currency"][] = [
    ["Leads", "leads", "count"],
    ["Apresentações", "presentations", "count"],
    ["Contratos enviados", "contractsSent", "count"],
    ["Vendas", "sales", "count"],
    ["Faturamento", "salesValue", "currency"],
  ];
  return pairs.map(([label, key, unit]) => {
    const v = current[key] as number;
    const r = reference[key] as number;
    const delta = v - r;
    const deltaPercent = r > 0 ? delta / r : null;
    return { label, value: v, reference: r, delta, deltaPercent, unit };
  });
}

export function buildComparative(
  userIds: string[],
  monthKey: string,
  axis: ComparativeAxis,
): ComparativeReport {
  const current = loadSubjectSummary(userIds, monthKey);
  const month = findMonth(monthKey);

  if (axis === "annual") {
    const yearMonths = AVAILABLE_MONTHS.filter((m) => m.year === month.year);
    let acc = { leads: 0, calls: 0, presentations: 0, contractsSent: 0, sales: 0, salesValue: 0, conversion: 0 } as KpiSummary;
    for (const m of yearMonths) acc = sumSummary(acc, loadSubjectSummary(userIds, m.key));
    const ref = yearMonths.length > 0 ? scaleSummary(acc, 1 / yearMonths.length) : acc;
    return {
      axis,
      axisLabel: AXIS_LABEL[axis],
      hint: `Média das ${yearMonths.length} competências disponíveis em ${month.year}.`,
      cells: buildCells(current, ref),
      hasReference: yearMonths.length > 0,
    };
  }

  if (axis === "previous") {
    const idx = AVAILABLE_MONTHS.findIndex((m) => m.key === monthKey);
    const prev = idx > 0 ? AVAILABLE_MONTHS[idx - 1] : null;
    const ref = prev
      ? loadSubjectSummary(userIds, prev.key)
      : ({ leads: 0, calls: 0, presentations: 0, contractsSent: 0, sales: 0, salesValue: 0, conversion: 0 } as KpiSummary);
    return {
      axis,
      axisLabel: AXIS_LABEL[axis],
      hint: prev ? `Competência anterior: ${prev.label}.` : "Não há competência anterior disponível.",
      cells: buildCells(current, ref),
      hasReference: !!prev,
    };
  }

  // historical
  let acc = { leads: 0, calls: 0, presentations: 0, contractsSent: 0, sales: 0, salesValue: 0, conversion: 0 } as KpiSummary;
  for (const m of AVAILABLE_MONTHS) acc = sumSummary(acc, loadSubjectSummary(userIds, m.key));
  return {
    axis,
    axisLabel: AXIS_LABEL[axis],
    hint: `Acumulado de ${AVAILABLE_MONTHS.length} competências disponíveis.`,
    cells: buildCells(current, acc),
    hasReference: AVAILABLE_MONTHS.length > 0,
  };
}

export function narrativeFromComparative(name: string, cmp: ComparativeReport): string {
  const rev = cmp.cells.find((c) => c.unit === "currency");
  const sales = cmp.cells.find((c) => c.label === "Vendas");
  const leads = cmp.cells.find((c) => c.label === "Leads");
  if (!rev || !sales || !leads || !cmp.hasReference) {
    return `Não há base comparativa suficiente para gerar a análise ${cmp.axisLabel.toLowerCase()} de ${name}.`;
  }
  const dir = (d: number) => (d > 0 ? "acima" : d < 0 ? "abaixo" : "em linha com");
  const pct = (p: number | null) => (p === null ? "sem referência" : `${(Math.abs(p) * 100).toFixed(1).replace(".", ",")}%`);
  return `${name} está ${dir(rev.delta)} da referência (${cmp.axisLabel}) em faturamento (${pct(rev.deltaPercent)}), com volume de vendas ${dir(sales.delta)} da referência (${pct(sales.deltaPercent)}) e captação de leads ${dir(leads.delta)} do padrão (${pct(leads.deltaPercent)}).`;
}