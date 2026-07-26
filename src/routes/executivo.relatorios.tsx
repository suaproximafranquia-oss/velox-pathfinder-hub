import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  LineChart,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  UserSquare2,
  Building2,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { AVAILABLE_MONTHS } from "@/lib/kpi-manager";
import {
  availableExecutives,
  availableScopes,
  availableTeams,
  buildReport,
  defaultSelection,
  REPORT_SCOPE_LABEL,
  requestExport,
  type ReportScope,
  type ReportSelection,
} from "@/lib/reports";
import { ChartCard } from "@/components/executive/brain/chart-card";
import { FunnelCard } from "@/components/executive/brain/funnel-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios Executivos — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const SCOPE_ICON: Record<ReportScope, typeof UserSquare2> = {
  individual: UserSquare2,
  team: Users,
  company: Building2,
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

  if (!session || !selection || !report) return null;

  const scopes = availableScopes(session);
  const executives = availableExecutives(session);
  const teams = availableTeams(session);

  function setScope(scope: ReportScope) {
    if (!session || !selection) return;
    setSelection({
      ...selection,
      scope,
      executiveId: selection.executiveId ?? session.userId,
      teamId: selection.teamId ?? teams[0]?.id,
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
          {selection.scope === "team" && teams.length > 0 && (
            <Select
              icon={Users}
              value={selection.teamId ?? teams[0].id}
              onChange={(v) => setSelection({ ...selection, teamId: v })}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
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
              const r = requestExport(report, fmt);
              window.alert(
                `Preparação concluída (${r.format}). A geração definitiva será liberada na próxima Sprint.`,
              );
            }}
          />
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Leads" value={report.summary.leads.toLocaleString("pt-BR")} icon={Activity} />
        <SummaryCard label="Apresentações" value={report.summary.presentations.toLocaleString("pt-BR")} icon={Sparkles} />
        <SummaryCard label="Vendas" value={report.summary.sales.toLocaleString("pt-BR")} icon={TrendingUp} />
        <SummaryCard
          label="Faturamento"
          value={report.summary.salesValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
          icon={BarChart3}
          highlight
        />
      </div>

      {/* Gráficos de evolução */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Evolução diária — Vendas"
          subtitle="Vendas assinadas por dia da competência"
          icon={LineChart}
          data={report.daily["contractsSigned" as keyof typeof report.daily] ?? []}
        />
        <ChartCard
          title="Evolução semanal — Vendas"
          subtitle="Agrupamento semanal das vendas"
          icon={TrendingUp}
          data={report.weekly}
        />
        <ChartCard
          title="Evolução mensal — Vendas"
          subtitle="Comparativo entre as competências disponíveis"
          icon={BarChart3}
          data={report.monthly}
        />
        <FunnelCard stages={report.funnel} />
      </div>

      {/* Comparativo entre períodos */}
      <div className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-[color:var(--gold)]" />
          <h3 className="font-display text-lg">Comparativo com a competência anterior</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.comparison.map((c) => {
            const positive = c.delta >= 0;
            return (
              <div
                key={c.label}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--navy-deep)]/40 p-4"
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                  {c.label}
                </p>
                <p className="font-display text-xl mt-1 tabular-nums">
                  {c.label === "Faturamento"
                    ? c.current.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                    : c.current.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] mt-1 text-[color:var(--muted-foreground)]">
                  Anterior:{" "}
                  <span className="tabular-nums">
                    {c.label === "Faturamento"
                      ? c.previous.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                      : c.previous.toLocaleString("pt-BR")}
                  </span>
                </p>
                <p
                  className={cn(
                    "mt-2 text-[11px] font-medium",
                    positive ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {positive ? "▲" : "▼"} {Math.abs(c.delta).toFixed(1)}%
                </p>
              </div>
            );
          })}
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

function ExportActions({ onExport }: { onExport: (fmt: "pdf" | "excel" | "share") => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ExportBtn icon={FileText} onClick={() => onExport("pdf")}>
        PDF
      </ExportBtn>
      <ExportBtn icon={FileSpreadsheet} onClick={() => onExport("excel")}>
        Excel
      </ExportBtn>
      <ExportBtn icon={Share2} onClick={() => onExport("share")}>
        Compartilhar
      </ExportBtn>
    </div>
  );
}

function ExportBtn({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof Download;
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
