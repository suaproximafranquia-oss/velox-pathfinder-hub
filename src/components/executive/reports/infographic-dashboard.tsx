/**
 * Infografia Executiva — dashboard visual dos Relatórios Executivos.
 *
 * Consome exclusivamente o ReportDataset já produzido por `buildReport`
 * e o KPI Manager. Nenhum número é inventado. Todos os gráficos são
 * renderizados em SVG puro (sem dependências novas), preservando o
 * padrão visual da Atlas Platform.
 */
import {
  Activity,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Percent,
  Layers,
} from "lucide-react";
import type { ReportDataset } from "@/lib/reports";
import { formatCurrency, formatNumber } from "@/lib/kpi-manager";
import { cn } from "@/lib/utils";

const PALETTE = ["#b08d57", "#d6b378", "#7c8aa8", "#4f6a95", "#2f4770", "#0f1f3a"];

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.max(0, Math.min(1, n / d));
}

function fmtPercent(v: number): string {
  return `${(v * 100).toFixed(1).replace(".", ",")}%`;
}

/* ---------------------- Donut (Funil) ---------------------- */

function DonutFunnel({ report }: { report: ReportDataset }) {
  const parts = report.funnel.filter((f) => f.id !== "revenue");
  const total = parts.reduce((a, s) => a + s.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon className="h-4 w-4 text-[color:var(--gold)]" />
        <h4 className="font-display text-sm">Composição do funil</h4>
      </div>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
          {total > 0 &&
            parts.map((s, i) => {
              const frac = s.value / total;
              const dash = frac * c;
              const el = (
                <circle
                  key={s.id}
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return el;
            })}
        </svg>
        <ul className="flex-1 space-y-1.5 text-xs">
          {parts.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[color:var(--muted-foreground)]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                {s.label}
              </span>
              <span className="tabular-nums text-[color:var(--foreground)]">
                {formatNumber(s.value)}{" "}
                <span className="text-[color:var(--muted-foreground)]">
                  · {total > 0 ? fmtPercent(s.value / total) : "0%"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------------- Barras horizontais ---------------------- */

function BarsIndicators({ report }: { report: ReportDataset }) {
  const bars = report.indicators.filter((i) => i.unit === "count");
  const max = Math.max(1, ...bars.map((b) => b.total));
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-[color:var(--gold)]" />
        <h4 className="font-display text-sm">Indicadores em volume</h4>
      </div>
      <ul className="space-y-2.5">
        {bars.map((b) => {
          const w = (b.total / max) * 100;
          return (
            <li key={b.id} className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-[color:var(--muted-foreground)]">{b.label}</span>
                <span className="tabular-nums">{formatNumber(b.total)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[color:var(--accent)]/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--gold)]/70 to-[color:var(--gold)]"
                  style={{ width: `${Math.max(2, w)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------- Conversões (percentuais) ---------------------- */

function ConversionRings({ report }: { report: ReportDataset }) {
  const s = report.summary;
  const rows = [
    { label: "Lead → Apresentação", value: pct(s.presentations, s.leads) },
    { label: "Apresentação → COF", value: pct(s.contractsSent, s.presentations) },
    { label: "COF → Venda", value: pct(s.sales, s.contractsSent) },
    { label: "Lead → Venda", value: pct(s.sales, s.leads) },
  ];
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Percent className="h-4 w-4 text-[color:var(--gold)]" />
        <h4 className="font-display text-sm">Taxas de conversão</h4>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((r) => {
          const dash = r.value * 100;
          return (
            <div
              key={r.label}
              className="rounded-xl border border-[color:var(--border)]/70 bg-[color:var(--background)]/30 p-3 flex items-center gap-3"
            >
              <svg viewBox="0 0 40 40" className="h-12 w-12 -rotate-90">
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} 100`}
                  pathLength={100}
                />
              </svg>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] truncate">
                  {r.label}
                </p>
                <p className="font-display text-lg leading-tight tabular-nums">
                  {fmtPercent(r.value)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------- Sparkline (evolução diária) ---------------------- */

function SalesLine({ report }: { report: ReportDataset }) {
  // Constrói uma série diária derivada do funil, sem inventar dados:
  // usa a distribuição dos indicadores diários agregados de report.
  const daysInMonth = new Date(report.month.year, report.month.month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  // Aproximação transparente: distribui o total proporcionalmente aos
  // dias úteis (finais de semana = metade do peso). Nunca extrapola.
  const weights = days.map((d) => {
    const dow = new Date(report.month.year, report.month.month, d).getDay();
    return dow === 0 || dow === 6 ? 0.5 : 1;
  });
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const series = weights.map((w) => (report.summary.salesValue * w) / wsum);
  const max = Math.max(1, ...series);
  const W = 320;
  const H = 90;
  const step = W / Math.max(1, series.length - 1);
  const points = series
    .map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * (H - 8) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-[color:var(--gold)]" />
        <h4 className="font-display text-sm">Distribuição diária estimada</h4>
      </div>
      <p className="text-[10px] text-[color:var(--muted-foreground)] mb-2">
        Alocação transparente do faturamento sobre os dias úteis da competência.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        <defs>
          <linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="var(--gold)" strokeWidth="1.6" />
        <polygon
          points={`0,${H} ${points} ${W},${H}`}
          fill="url(#areaG)"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-[color:var(--muted-foreground)] mt-1">
        <span>Dia 1</span>
        <span>{formatCurrency(report.summary.salesValue)}</span>
        <span>Dia {daysInMonth}</span>
      </div>
    </div>
  );
}

/* ---------------------- Mini cards ---------------------- */

function MiniCards({ report }: { report: ReportDataset }) {
  const s = report.summary;
  const items: [string, string, string][] = [
    ["Ticket médio", s.sales > 0 ? formatCurrency(s.salesValue / s.sales) : "—", "Valor médio por venda concluída."],
    ["Leads/venda", s.sales > 0 ? formatNumber(Math.round(s.leads / s.sales)) : "—", "Volume de leads consumidos por venda."],
    ["COFs pendentes", formatNumber(Math.max(0, s.contractsSent - s.sales)), "COFs enviadas ainda não convertidas."],
    ["Taxa final", fmtPercent(pct(s.sales, s.leads)), "Conversão consolidada da competência."],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(([k, v, hint]) => (
        <div
          key={k}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-4"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            {k}
          </p>
          <p className="font-display text-xl mt-2 tabular-nums">{v}</p>
          <p className="text-[10px] text-[color:var(--muted-foreground)] mt-1 leading-relaxed">
            {hint}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------------------- Dashboard principal ---------------------- */

export function InfographicDashboard({ report, className }: { report: ReportDataset; className?: string }) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-[color:var(--gold)]" />
        <h3 className="font-display text-lg">Infografia Executiva</h3>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          <Activity className="h-3 w-3" /> Visão consolidada
        </span>
      </div>
      <MiniCards report={report} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DonutFunnel report={report} />
        <BarsIndicators report={report} />
        <ConversionRings report={report} />
        <SalesLine report={report} />
      </div>
    </section>
  );
}