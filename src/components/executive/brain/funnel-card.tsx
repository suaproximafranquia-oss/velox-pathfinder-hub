/**
 * DEF 3.0.1 §4 e §5 — Novo desenho oficial do Funil (Brain Analytics).
 *
 * Somente o DESENHO muda: os dados, o escopo e o restante do painel
 * permanecem exatamente iguais. Cada etapa é uma peça tridimensional com
 * disco superior, corpo afunilado luminoso e halo inferior. As
 * microinterações são discretas: leve escala, brilho suave, sombra e
 * profundidade — sem janelas, pop-ups ou cards laterais.
 */
import { Brain } from "lucide-react";
import type { FunnelStage } from "@/lib/brain-data";

/** Paleta oficial do novo funil — do azul ao verde. */
const PALETTE: { light: string; mid: string; dark: string; glow: string }[] = [
  { light: "#5AB4FF", mid: "#1E7BE0", dark: "#0B4C9B", glow: "#3B9BFF" },
  { light: "#A78BFA", mid: "#7C4DE0", dark: "#4C2A9B", glow: "#8B5CF6" },
  { light: "#F5B34A", mid: "#DE8A16", dark: "#9B5A08", glow: "#F59E0B" },
  { light: "#3FD9B0", mid: "#12A886", dark: "#0A6B56", glow: "#14C79E" },
  { light: "#7BE86A", mid: "#37B734", dark: "#1D7620", glow: "#4ADE55" },
  { light: "#A6F08F", mid: "#5FC957", dark: "#2C8A33", glow: "#77E06A" },
];

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);

export function FunnelCard({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value ?? 0;
  const n = Math.max(stages.length, 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.85)]">
      <div className="mb-7 flex flex-col items-center text-center">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-[#3B9BFF]" aria-hidden />
          <h2 className="font-display text-2xl">Funil de Vendas</h2>
        </div>
        <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
          Da atratividade à conversão, com inteligência.
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl pb-8" style={{ perspective: "1200px" }}>
        {stages.map((s, i) => {
          const tone = PALETTE[i % PALETTE.length]!;
          const isRevenue = s.id === "revenue";
          const wTop = 100 - i * (56 / Math.max(n - 1, 1));
          const wBottom = 100 - (i + 1) * (56 / Math.max(n - 1, 1));
          const pct = top > 0 ? (s.value / top) * 100 : 0;
          const insetB = ((wTop - wBottom) / wTop) * 50;

          return (
            <div
              key={s.id}
              className="funnel-stage relative mx-auto"
              style={{ width: `${wTop}%`, marginBottom: 20 }}
            >
              {/* Halo elíptico de profundidade sob a peça */}
              <span
                aria-hidden
                className="funnel-halo absolute left-[6%] right-[6%]"
                style={{
                  bottom: -14,
                  height: 26,
                  borderRadius: "50%",
                  border: `1px solid ${tone.glow}`,
                  opacity: 0.35,
                  filter: "blur(0.4px)",
                }}
              />

              {/* Disco superior */}
              <span
                aria-hidden
                className="absolute left-0 right-0"
                style={{
                  top: -12,
                  height: 24,
                  borderRadius: "50%",
                  background: `linear-gradient(180deg, ${tone.light} 0%, ${tone.mid} 100%)`,
                  boxShadow:
                    "inset 0 -4px 9px rgba(0,0,0,0.30), inset 0 2px 3px rgba(255,255,255,0.45)",
                }}
              />

              {/* Corpo afunilado */}
              <div
                className="relative h-[80px] w-full"
                style={{
                  clipPath: `polygon(0% 0%, 100% 0%, ${100 - insetB}% 100%, ${insetB}% 100%)`,
                  background: `linear-gradient(90deg, ${tone.dark} 0%, ${tone.mid} 24%, ${tone.light} 50%, ${tone.mid} 76%, ${tone.dark} 100%)`,
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.05) 42%, rgba(0,0,0,0.38) 100%)",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center px-14">
                  <div className="min-w-0 text-center">
                    <span className="block truncate text-[11px] font-medium uppercase tracking-[0.16em] text-white/90">
                      {s.label}
                    </span>
                    <span className="block font-display text-[20px] leading-tight tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                      {isRevenue ? brl(s.value) : s.value.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {isRevenue ? null : (
                    <span className="absolute right-[9%] text-[11px] tabular-nums text-white/85">
                      {pct.toFixed(1).replace(".", ",")}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
