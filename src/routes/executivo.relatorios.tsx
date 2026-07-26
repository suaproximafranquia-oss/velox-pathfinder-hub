import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  CalendarRange,
  FileSpreadsheet,
  FileText,
  Info,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  UserSquare2,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { AVAILABLE_MONTHS, formatCurrency, formatNumber } from "@/lib/kpi-manager";
import {
  availableExecutives,
  availableScopes,
  brainSummaryFromReport,
  buildReport,
  defaultSelection,
  REPORT_SCOPE_LABEL,
  type ReportScope,
  type ReportSelection,
} from "@/lib/reports";
import {
  buildComparative,
  narrativeFromComparative,
  type ComparativeAxis,
  type ComparativeReport,
} from "@/lib/report-comparatives";
import { exportReportPdf, exportReportExcel } from "@/lib/report-generators";
import { FunnelCard } from "@/components/executive/brain/funnel-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios Executivos — Atlas Platform" },
      {
        name: "description",
        content:
          "Relatórios de equipe e individuais com dados oficiais do KPI Manager.",
      },
      { property: "og:title", content: "Relatórios Executivos — Atlas Platform" },
      {
        property: "og:description",
        content:
          "Relatórios de equipe e individuais com dados oficiais do KPI Manager.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const SCOPE_ICON: Record<ReportScope, typeof UserSquare2> = {
  individual: UserSquare2,
  team: Users,
};

function ReportsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [selection, setSelection] = useState<ReportSelection | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
    setSelection(defaultSelection(s));
  }, [navigate]);

  const report = useMemo(
    () => (session && selection ? buildReport(session, selection) : null),
    [session, selection],
  );

  const comparatives = useMemo<ComparativeReport[]>(() => {
    if (!session || !selection || !report) return [];
    const ids = report.provenance.executivesConsidered;
    if (ids.length === 0) return [];
    const axes: ComparativeAxis[] = ["annual", "previous", "historical"];
    return axes.map((a) => buildComparative(ids, selection.monthKey, a));
  }, [session, selection, report]);

  const brainSummary = useMemo(
    () => (report ? brainSummaryFromReport(report) : ""),
    [report],
  );

  if (!session || !selection || !report) return null;

  const scopes = availableScopes(session);
  const executives = availableExecutives(session);

  function setScope(scope: ReportScope) {
    if (!session || !selection) return;
    setSelection({
      ...selection,
      scope,
      executiveId: selection.executiveId ?? session.userId,
    });
  }

  return (
    <ExecutiveShell session={session} title="Relatórios Executivos">
      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 p-1 text-xs">
          {scopes.map((s) => {
            const Icon = SCOPE_ICON[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition",
                  selection.scope === s
                    ? "bg-[color:var(--accent)] text-[color:var(--foreground)]"
                    : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {REPORT_SCOPE_LABEL[s]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selection.scope === "individual" && (
            <Select
              icon={UserSquare2}
              value={selection.executiveId ?? session.userId}
              onChange={(v) => setSelection({ ...selection, executiveId: v })}
              options={executives.map((e) => ({ value: e.id, label: e.name }))}
            />
          )}
          <Select
            icon={CalendarRange}
            value={selection.monthKey}
            onChange={(v) => setSelection({ ...selection, monthKey: v })}
            options={AVAILABLE_MONTHS.map((m) => ({ value: m.key, label: m.label }))}
          />
        </div>
      </div>

      {/* Cabeçalho / rastreabilidade */}
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              {report.subtitle}
            </p>
            <h2 className="font-display text-2xl mt-1">{report.title}</h2>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-3 max-w-2xl leading-relaxed">
              {report.narrative}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {report.sources.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]"
                >
                  <ShieldCheck className="h-3 w-3 text-[color:var(--gold)]" /> Fonte: {s}
                </span>
              ))}
            </div>
          </div>
          <ExportActions
            onExport={(fmt) => {
              if (fmt === "pdf") exportReportPdf(report, { brainSummary, comparatives });
              else exportReportExcel(report, { brainSummary, comparatives });
            }}
          />
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Leads" value={report.summary.leads.toLocaleString("pt-BR")} icon={Activity} />
        <SummaryCard label="Apresentações" value={report.summary.presentations.toLocaleString("pt-BR")} icon={Sparkles} />
        <SummaryCard label="COFs Enviadas" value={report.summary.contractsSent.toLocaleString("pt-BR")} icon={FileText} />
        <SummaryCard label="Vendas" value={report.summary.sales.toLocaleString("pt-BR")} icon={TrendingUp} />
        <SummaryCard
          label="Faturamento"
          value={report.summary.salesValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
          icon={BarChart3}
          highlight
        />
      </div>

      {/* Funil executivo */}
      <div className="mt-8">
        <FunnelCard stages={report.funnel} />
      </div>

      {/* Análise Brain automática */}
      <div className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-[color:var(--gold)]" />
          <h3 className="font-display text-lg">Análise Brain</h3>
          <span className="ml-auto text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Interpretação automática
          </span>
        </div>
        <p className="text-sm text-[color:var(--foreground)]/90 leading-relaxed">{brainSummary}</p>
      </div>

      {/* Infográficos comparativos */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-[color:var(--gold)]" />
          <h3 className="font-display text-lg">Comparativos</h3>
          <span className="ml-auto text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Base: KPI Manager
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {comparatives.map((cmp) => (
            <ComparativeCard
              key={cmp.axis}
              cmp={cmp}
              narrative={narrativeFromComparative(
                report.selection.scope === "team" ? "A equipe" : report.title.replace(/^.*—\s*/, ""),
                cmp,
              )}
            />
          ))}
        </div>
      </div>

      {/* Tabela detalhada de indicadores */}
      <div className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[color:var(--gold)]" />
            <h3 className="font-display text-lg">Tabela detalhada de indicadores</h3>
          </div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            KPI Manager · {report.month.label}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                <th className="text-left px-6 py-3 font-normal">Indicador</th>
                <th className="text-right px-6 py-3 font-normal">Total</th>
                <th className="text-right px-6 py-3 font-normal">Média diária</th>
              </tr>
            </thead>
            <tbody>
              {report.indicators.map((ind) => (
                <tr
                  key={ind.id}
                  className="border-t border-[color:var(--border)]/60 hover:bg-[color:var(--accent)]/30 transition-colors"
                >
                  <td className="px-6 py-3">{ind.label}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-[color:var(--foreground)]">
                    {ind.formatted}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-[color:var(--muted-foreground)]">
                    {ind.unit === "currency"
                      ? ind.average.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                      : ind.average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Governança */}
      <div className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy-deep)]/40 p-5 flex items-start gap-3">
        <Info className="h-4 w-4 text-[color:var(--gold)] mt-0.5 flex-shrink-0" />
        <div className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
          Todos os indicadores são obtidos automaticamente do <strong className="text-[color:var(--foreground)]">KPI Manager</strong>. Nenhum
          valor é digitado ou estimado nesta tela. Esta mesma base alimentará o
          Brain Analytics e a Inteligência Artificial da Atlas Platform,
          preservando a rastreabilidade e as permissões do usuário autenticado.
        </div>
      </div>
    </ExecutiveShell>
  );
}

/* ---------------------- Componentes locais ---------------------- */

function SummaryCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        highlight
          ? "border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--accent)] to-transparent"
          : "border-[color:var(--border)] bg-[color:var(--card)]/30",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          {label}
        </p>
        <Icon className="h-4 w-4 text-[color:var(--gold)]" strokeWidth={1.6} />
      </div>
      <p className="font-display text-2xl mt-3 tabular-nums">{value}</p>
    </div>
  );
}

function Select({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon: typeof CalendarRange;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-1.5 text-xs">
      <Icon className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none text-[color:var(--foreground)] pr-1"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[color:var(--navy)]">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExportActions({ onExport }: { onExport: (fmt: "pdf" | "excel") => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ExportBtn icon={FileText} onClick={() => onExport("pdf")}>
        PDF
      </ExportBtn>
      <ExportBtn icon={FileSpreadsheet} onClick={() => onExport("excel")}>
        Excel
      </ExportBtn>
    </div>
  );
}

function ExportBtn({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof FileText;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function ComparativeCard({
  cmp,
  narrative,
}: {
  cmp: ComparativeReport;
  narrative: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[color:var(--gold)]" />
        <h4 className="font-display text-sm">{cmp.axisLabel}</h4>
      </div>
      <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">{cmp.hint}</p>
      <div className="mt-4 space-y-2">
        {cmp.cells.map((c) => {
          const up = c.delta >= 0;
          const pct = c.deltaPercent === null
            ? "—"
            : `${up ? "+" : ""}${(c.deltaPercent * 100).toFixed(1).replace(".", ",")}%`;
          const cur = c.unit === "currency" ? formatCurrency(c.value) : formatNumber(c.value);
          return (
            <div key={c.label} className="flex items-center justify-between text-xs">
              <span className="text-[color:var(--muted-foreground)]">{c.label}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-[color:var(--foreground)]">{cur}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px]",
                    !cmp.hasReference || c.deltaPercent === null
                      ? "bg-[color:var(--accent)]/40 text-[color:var(--muted-foreground)]"
                      : up
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-rose-400/10 text-rose-300",
                  )}
                >
                  {c.deltaPercent !== null && (up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
                  {pct}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-[color:var(--muted-foreground)] leading-relaxed border-t border-[color:var(--border)]/60 pt-3">
        {narrative}
      </p>
    </div>
  );
}
