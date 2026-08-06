/**
 * IA EXECUTIVA — Brain Analytics.
 * Disponível apenas para Administrador e Gestora. Interpreta somente os
 * indicadores internos do Brain Analytics / KPI Manager e devolve um
 * relatório executivo institucional em PDF.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, X } from "lucide-react";
import { generateBrainReport } from "@/lib/brain-ai.functions";
import { generateBrainExecutivePdf } from "@/lib/brain-ai-report";
import type { BrainAnalytics } from "@/lib/brain-analytics";
import type { BrainSnapshot } from "@/lib/brain-data";

const SUGGESTIONS = [
  "Relatório geral da equipe",
  "Comparar executivos",
  "Ranking de conversão",
  "Gargalos do funil",
  "Evolução do faturamento",
  "Comparação com mês anterior",
  "Comparação anual",
  "Performance comercial",
  "Eficiência da equipe",
  "Resumo executivo",
];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Serializa os dados internos — única fonte permitida para a IA. */
function serialize(a: BrainAnalytics, s: BrainSnapshot): string {
  const kpis = s.kpis.map((k) => `- ${k.label}: ${k.value} (${k.description})`).join("\n");
  const funnel = s.funnel.map((f) => `- ${f.label}: ${f.value}`).join("\n");
  const conv = a.conversions
    .map((c) => `- ${c.label}: ${pct(c.rate)} (${c.from} → ${c.to})`)
    .join("\n");
  const comp = a.comparison.rows
    .map(
      (r) =>
        `- ${r.label} | atual: ${r.current} | ${a.comparison.previousLabel}: ${r.previous} | ${a.comparison.annualLabel}: ${r.annualAverage.toFixed(1)} | var. vs anterior: ${r.vsPrevious === null ? "n/d" : pct(r.vsPrevious)} | var. vs média anual: ${r.vsAnnual === null ? "n/d" : pct(r.vsAnnual)}`,
    )
    .join("\n");
  const ins = a.insights.map((i) => `- [${i.tone}] ${i.title}: ${i.detail}`).join("\n");
  return [
    `ESCOPO: ${a.subjectLabel}`,
    `COMPETÊNCIA: ${a.monthLabel}`,
    `LEITURA ATUAL: ${a.headline}`,
    `\nINDICADORES DO PERÍODO:\n${kpis}`,
    `\nFUNIL:\n${funnel}`,
    `\nCONVERSÕES:\n${conv}`,
    `\nCOMPARATIVOS:\n${comp}`,
    `\nINSIGHTS JÁ CALCULADOS:\n${ins}`,
    `\nFECHAMENTO: ${a.closing}`,
  ].join("\n");
}

export function ExecutiveAiDialog({
  open,
  onClose,
  analytics,
  snapshot,
  actorName,
}: {
  open: boolean;
  onClose: () => void;
  analytics: BrainAnalytics;
  snapshot: BrainSnapshot;
  actorName: string;
}) {
  const run = useServerFn(generateBrainReport);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(prompt: string) {
    const q = prompt.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const report = await run({
        data: { request: q, dataset: serialize(analytics, snapshot) },
      });
      generateBrainExecutivePdf({ report, analytics, snapshot, request: q, actorName });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--background)]/85 p-4"
      onClick={() => (busy ? null : onClose())}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
              IA Executiva
            </span>
            <h3 className="font-display text-xl mt-1">Relatório Inteligente</h3>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              Análise exclusiva dos dados internos do Brain Analytics e do KPI Manager.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-lg border border-[color:var(--border)] p-1.5 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)] disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Que tipo de relatório você deseja gerar?
            </label>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
              disabled={busy}
              placeholder="Descreva livremente o relatório desejado…"
              className="mt-2 w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--gold)]/50"
            />
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              Sugestões rápidas
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRequest(s);
                    void submit(s);
                  }}
                  className="cursor-pointer rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] transition hover:border-[color:var(--gold)]/40 hover:text-[color:var(--foreground)] disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-xs text-[color:var(--destructive)]">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] px-6 py-4">
          <p className="text-[10px] text-[color:var(--muted-foreground)]">
            O relatório é gerado em PDF executivo, sem consultas externas.
          </p>
          <button
            type="button"
            onClick={() => void submit(request)}
            disabled={busy || !request.trim()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[color:var(--gold)] px-4 py-2 text-xs font-semibold text-[color:var(--navy)] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Gerando relatório…" : "Gerar relatório"}
          </button>
        </footer>
      </div>
    </div>
  );
}
