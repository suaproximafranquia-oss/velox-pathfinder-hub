/**
 * Blocos analíticos do Brain Analytics.
 * Consolidam o conteúdo executivo da antiga experiência de Relatórios.
 */
import type {
  BrainInsight,
  ComparisonReport,
  ConversionRate,
} from "@/lib/brain-analytics";
import { cn } from "@/lib/utils";

export function BlockTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
        {eyebrow}
      </span>
      <h2 className="font-display text-lg mt-1">{title}</h2>
      {description ? (
        <p className="text-xs text-[color:var(--muted-foreground)] mt-1 max-w-2xl leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function ExecutiveIntro({
  subject,
  monthLabel,
  headline,
}: {
  subject: string;
  monthLabel: string;
  headline: string;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--card)]/40 p-6 md:p-7">
      <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
        Introdução executiva
      </span>
      <h2 className="font-display text-xl md:text-2xl mt-2">
        Painel executivo consolidado · {monthLabel}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)] max-w-3xl">
        O Brain Analytics é o painel executivo definitivo da plataforma. Ele consolida
        automaticamente os principais indicadores operacionais, comerciais e estratégicos
        da operação, reunindo evolução histórica, comparativos, distribuição de Leads,
        conversões e análises automáticas em uma única leitura. Escopo atual:{" "}
        <span className="text-[color:var(--foreground)]">{subject}</span>.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--foreground)]/90 max-w-3xl">
        {headline}
      </p>
    </section>
  );
}

export function ConversionGrid({ items }: { items: ConversionRate[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((c) => {
        const width = Math.min(Math.max(c.rate * 100, 2), 100);
        return (
          <div
            key={c.id}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-5"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              {c.label}
            </p>
            <p className="font-display text-2xl mt-1.5 tabular-nums">
              {(c.rate * 100).toFixed(1).replace(".", ",")}%
            </p>
            <div className="mt-2.5 h-1.5 rounded-full bg-[color:var(--border)]/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-[color:var(--gold)]/80"
                style={{ width: `${width}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)] leading-snug">
              {c.from.toLocaleString("pt-BR")} → {c.to.toLocaleString("pt-BR")} · {c.hint}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function ComparisonTable({ report }: { report: ComparisonReport }) {
  const fmt = (v: number, unit: "count" | "currency") =>
    unit === "currency"
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        }).format(v)
      : new Intl.NumberFormat("pt-BR").format(Math.round(v));

  const Delta = ({ value }: { value: number | null }) => (
    <span
      className={cn(
        "tabular-nums",
        value === null
          ? "text-[color:var(--muted-foreground)]"
          : value > 0
            ? "text-emerald-400"
            : value < 0
              ? "text-rose-400"
              : "text-[color:var(--muted-foreground)]",
      )}
    >
      {value === null
        ? "—"
        : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1).replace(".", ",")}%`}
    </span>
  );

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
      <h3 className="font-display text-base">Comparativo executivo</h3>
      <p className="text-xs text-[color:var(--muted-foreground)] mb-4 mt-0.5">
        Competência atual · {report.previousLabel} · {report.annualLabel}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[560px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              <th className="text-left font-normal pb-2">Indicador</th>
              <th className="text-right font-normal pb-2">Atual</th>
              <th className="text-right font-normal pb-2">Mês anterior</th>
              <th className="text-right font-normal pb-2">Média anual</th>
              <th className="text-right font-normal pb-2">vs. anterior</th>
              <th className="text-right font-normal pb-2">vs. média</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--border)]/50">
                <td className="py-2 text-[color:var(--foreground)]">{r.label}</td>
                <td className="py-2 text-right tabular-nums">{fmt(r.current, r.unit)}</td>
                <td className="py-2 text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {report.hasPrevious ? fmt(r.previous, r.unit) : "—"}
                </td>
                <td className="py-2 text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {fmt(r.annualAverage, r.unit)}
                </td>
                <td className="py-2 text-right">
                  <Delta value={report.hasPrevious ? r.vsPrevious : null} />
                </td>
                <td className="py-2 text-right">
                  <Delta value={r.vsAnnual} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TONE: Record<BrainInsight["tone"], string> = {
  positivo: "border-emerald-500/30 text-emerald-400",
  atencao: "border-amber-400/30 text-amber-300",
  neutro: "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
};

export function InsightList({ insights }: { insights: BrainInsight[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {insights.map((i) => (
        <div
          key={i.id}
          className={cn(
            "rounded-2xl border bg-[color:var(--card)]/30 p-5",
            TONE[i.tone],
          )}
        >
          <p className="text-sm font-medium leading-snug">{i.title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
            {i.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ClosingSummary({ text }: { text: string }) {
  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/20 p-6">
      <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
        Resumo final
      </span>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)] max-w-3xl">
        {text}
      </p>
    </section>
  );
}
