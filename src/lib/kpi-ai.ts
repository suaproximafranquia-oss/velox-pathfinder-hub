/**
 * IA Gerencial — Camada de snapshot dos KPIs oficiais.
 *
 * Consome exclusivamente o KPI Manager e respeita as permissoes do
 * perfil ativo. Nada e inventado: o snapshot serializavel abaixo e o
 * unico contexto que a IA pode usar para responder.
 */
import {
  AVAILABLE_MONTHS,
  findMonth,
  formatCurrency,
  formatNumber,
  formatPercent,
  loadDataset,
  summarize,
  type KpiMonth,
  type KpiSummary,
} from "./kpi-manager";
import { visibleCollaborators } from "./teams";
import type { ExecutiveSession, ExecutiveUser } from "./executive-auth";

export type KpiExecutiveSnapshot = {
  id: string;
  name: string;
  current: KpiSummary;
  previous: KpiSummary | null;
};

export type KpiInsightSnapshot = {
  workspace: string;
  generatedAt: string;
  month: { key: string; label: string };
  previousMonth: { key: string; label: string } | null;
  scope: "team" | "individual";
  actor: { id: string; name: string; role: string };
  team: {
    current: KpiSummary;
    previous: KpiSummary | null;
    last90Days: KpiSummary;
  };
  executives: KpiExecutiveSnapshot[];
  availableMonths: { key: string; label: string }[];
};

function emptySummary(): KpiSummary {
  return {
    leads: 0,
    calls: 0,
    presentations: 0,
    contractsSent: 0,
    sales: 0,
    salesValue: 0,
    conversion: 0,
  };
}

function sumSummaries(list: KpiSummary[]): KpiSummary {
  const total = emptySummary();
  for (const s of list) {
    total.leads += s.leads;
    total.calls += s.calls;
    total.presentations += s.presentations;
    total.contractsSent += s.contractsSent;
    total.sales += s.sales;
    total.salesValue += s.salesValue;
  }
  total.conversion = total.leads > 0 ? total.sales / total.leads : 0;
  return total;
}

function summaryFor(userId: string, monthKey: string): KpiSummary {
  return summarize(loadDataset(userId, monthKey));
}

function previousMonthOf(monthKey: string): KpiMonth | null {
  const i = AVAILABLE_MONTHS.findIndex((m) => m.key === monthKey);
  if (i <= 0) return null;
  return AVAILABLE_MONTHS[i - 1];
}

function lastThreeMonths(monthKey: string): KpiMonth[] {
  const i = AVAILABLE_MONTHS.findIndex((m) => m.key === monthKey);
  if (i < 0) return [findMonth(monthKey)];
  const start = Math.max(0, i - 2);
  return AVAILABLE_MONTHS.slice(start, i + 1);
}

/**
 * Monta o contexto oficial da IA Gerencial. Somente Administrador e Gestor
 * podem consumir esta camada — a permissao e validada no componente.
 */
export function buildKpiInsightSnapshot(
  session: ExecutiveSession,
  monthKey: string,
): KpiInsightSnapshot {
  const month = findMonth(monthKey);
  const prev = previousMonthOf(month.key);
  const window = lastThreeMonths(month.key);
  const collaborators: ExecutiveUser[] = visibleCollaborators(session);

  const executives: KpiExecutiveSnapshot[] = collaborators.map((u) => ({
    id: u.id,
    name: u.name,
    current: summaryFor(u.id, month.key),
    previous: prev ? summaryFor(u.id, prev.key) : null,
  }));

  const team = {
    current: sumSummaries(executives.map((e) => e.current)),
    previous: prev
      ? sumSummaries(executives.map((e) => e.previous ?? emptySummary()))
      : null,
    last90Days: sumSummaries(
      collaborators.flatMap((u) => window.map((m) => summaryFor(u.id, m.key))),
    ),
  };

  return {
    workspace: "Atlas Platform",
    generatedAt: new Date().toISOString(),
    month: { key: month.key, label: month.label },
    previousMonth: prev ? { key: prev.key, label: prev.label } : null,
    scope: collaborators.length > 1 ? "team" : "individual",
    actor: {
      id: session.userId,
      name: session.name,
      role: session.activeRole,
    },
    team,
    executives,
    availableMonths: AVAILABLE_MONTHS.map((m) => ({ key: m.key, label: m.label })),
  };
}

/**
 * Serializa o snapshot em um bloco textual denso para o modelo. Mantem
 * numeros formatados em pt-BR para leitura direta na resposta.
 */
export function serializeSnapshotForPrompt(s: KpiInsightSnapshot): string {
  const line = (label: string, sum: KpiSummary) =>
    `${label}: Leads ${formatNumber(sum.leads)} · Apresentacoes ${formatNumber(sum.presentations)} · Contratos enviados ${formatNumber(sum.contractsSent)} · Vendas ${formatNumber(sum.sales)} · Faturamento ${formatCurrency(sum.salesValue)} · Conversao Lead->Venda ${formatPercent(sum.conversion)}`;

  const rows: string[] = [];
  rows.push(`WORKSPACE: ${s.workspace}`);
  rows.push(`COMPETENCIA ATUAL: ${s.month.label} (${s.month.key})`);
  if (s.previousMonth)
    rows.push(`COMPETENCIA ANTERIOR: ${s.previousMonth.label} (${s.previousMonth.key})`);
  rows.push(`PERFIL DO USUARIO: ${s.actor.role}`);
  rows.push("");
  rows.push("### EQUIPE (agregado das permissoes do usuario)");
  rows.push(line("Mes atual", s.team.current));
  if (s.team.previous) rows.push(line("Mes anterior", s.team.previous));
  rows.push(line("Ultimos 90 dias (janela de ate 3 meses)", s.team.last90Days));
  rows.push("");
  rows.push("### EXECUTIVOS");
  for (const e of s.executives) {
    rows.push(`- ${e.name} (${e.id})`);
    rows.push(`   ${line("  Mes atual", e.current)}`);
    if (e.previous) rows.push(`   ${line("  Mes anterior", e.previous)}`);
  }
  rows.push("");
  rows.push(
    `MESES DISPONIVEIS: ${s.availableMonths.map((m) => `${m.label} (${m.key})`).join(", ")}`,
  );
  return rows.join("\n");
}