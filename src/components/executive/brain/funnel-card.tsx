/**
 * Funil Comercial Visual — componente gráfico nativo do Brain Analytics.
 *
 * Não usa barras horizontais, listas ou cards empilhados: cada etapa é
 * desenhada como uma faixa afunilada (trapézio) via clip-path, respeitando
 * a identidade visual do Portal. Alimentado automaticamente pelos dados
 * do KPI Manager.
 */
import type { FunnelStage } from "@/lib/brain-data";
import { cn } from "@/lib/utils";

const TONE: string[] = [
  "from-[color:var(--gold)] to-[color:var(--gold)]/70",
  "from-amber-400 to-amber-500/70",
  "from-sky-400 to-sky-500/70",
  "from-teal-400 to-teal-500/70",
  "from-indigo-400 to-indigo-500/70",
  "from-emerald-400 to-emerald-500/70",
];

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);

export function FunnelCard({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value ?? 0;

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
      <div className="mb-5">
        <h2 className="font-display text-lg">Funil comercial</h2>
        <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
          Da captação ao faturamento — conversão real entre etapas
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl">
        {stages.map((s, i) => {
          const isRevenue = s.id === "revenue";
          const prev = i > 0 ? stages[i - 1] : null;
          const stepRate =
            prev && prev.value > 0 && !isRevenue ? s.value / prev.value : null;
          const totalRate = top > 0 && !isRevenue ? s.value / top : null;

          // Largura afunilada: topo largo, base estreita.
          const wTop = 100 - i * (60 / Math.max(stages.length - 1, 1));
          const wBottom = 100 - (i + 1) * (60 / Math.max(stages.length - 1, 1));
          const inset = (100 - wTop) / 2;
          const insetB = (100 - wBottom) / 2;

          return (
            <div key={s.id} className="relative">
              <div
                className={cn(
                  "relative h-[68px] w-full bg-gradient-to-b",
                  TONE[i % TONE.length],
                )}
                style={{
                  clipPath: `polygon(${inset}% 0%, ${100 - inset}% 0%, ${100 - insetB}% 100%, ${insetB}% 100%)`,
                }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                  <span className="text-[11px] md:text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--navy-deep)]">
                    {s.label}
                  </span>
                  <span className="font-display text-base md:text-lg tabular-nums leading-tight text-[color:var(--navy-deep)]">
                    {isRevenue ? brl(s.value) : s.value.toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>

              {/* Percentual de conversão da etapa */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
                <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
                  {isRevenue
                    ? "Resultado"
                    : stepRate === null
                      ? "100%"
                      : `${(stepRate * 100).toFixed(1).replace(".", ",")}% da etapa anterior`}
                </span>
              </div>
              {totalRate !== null && i > 0 ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
                  <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
                    {(totalRate * 100).toFixed(1).replace(".", ",")}% do topo
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
