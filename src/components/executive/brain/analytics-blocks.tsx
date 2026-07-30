/**
 * Blocos analíticos do Brain Analytics.
 * Consolidam o conteúdo executivo da antiga experiência de Relatórios.
 */
import type {
  BrainInsight,
  ConversionRate,
  DistributionSlice,
} from "@/lib/brain-analytics";
import type { ComparativeReport } from "@/lib/report-comparatives";
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

export function DistributionCard({
  title,
  subtitle,
  slices,
}: {
  title: string;
  subtitle: string;
  slices: DistributionSlice[];
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
      <h3 className="font-display text-base">{title}</h3>
      <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5 mb-4">{subtitle}</p>
      {total === 0 ? (
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Nenhum registro no escopo selecionado.
        </p>
      ) : (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--border)]/40">
            {slices.map((s) =>
              s.value > 0 ? (
                <span
                  key={s.id}
                  title={`${s.label}: ${s.value}`}
                  className={cn("h-full", s.tone)}
                  style={{ width: `${(s.value / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-4 space-y-2">
            {slices.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-[color:var(--muted-foreground)]">
                  <span className={cn("h-2 w-2 rounded-full", s.tone)} />
                  {s.label}
                </span>
                <span className="tabular-nums text-[color:var(--foreground)]">
                  {s.value} · {total > 0 ? Math.round((s.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function ComparativeTable({ report }: { report: ComparativeReport }) {
  const fmt = (v: number, unit: "count" | "currency") =>
    unit === "currency"
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        }).format(v)
      : new Intl.NumberFormat("pt-BR").format(Math.round(v));
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-display text-base">Comparativo · {report.axisLabel}</h3>
      </div>
      <p className="text-xs text-[color:var(--muted-foreground)] mb-4">{report.hint}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              <th className="text-left font-normal pb-2">Indicador</th>
              <th className="text-right font-normal pb-2">Atual</th>
              <th className="text-right font-normal pb-2">Referência</th>
              <th className="text-right font-normal pb-2">Variação</th>
            </tr>
          </thead>
          <tbody>
            {report.cells.map((c) => (
              <tr key={c.label} className="border-t border-[color:var(--border)]/50">
                <td className="py-2 text-[color:var(--foreground)]">{c.label}</td>
                <td className="py-2 text-right tabular-nums">{fmt(c.value, c.unit)}</td>
                <td className="py-2 text-right tabular-nums text-[color:var(--muted-foreground)]">
                  {fmt(c.reference, c.unit)}
                </td>
                <td
                  className={cn(
                    "py-2 text-right tabular-nums",
                    c.delta > 0
                      ? "text-emerald-400"
                      : c.delta < 0
                        ? "text-rose-400"
                        : "text-[color:var(--muted-foreground)]",
                  )}
                >
                  {c.deltaPercent === null
                    ? "—"
                    : `${c.delta > 0 ? "+" : ""}${(c.deltaPercent * 100).toFixed(1).replace(".", ",")}%`}
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
