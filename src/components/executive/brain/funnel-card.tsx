/**
 * Funil Comercial 3D — componente premium nativo do Brain Analytics.
 *
 * Cada nível é uma peça independente do funil: disco superior elíptico,
 * corpo afunilado com gradiente e sombreamento lateral, e disco inferior
 * em sombra — criando profundidade e perspectiva reais, sem imagem,
 * sem barra e sem trapézio simples.
 *
 * Cada peça comunica apenas: Nome · Quantidade · Percentual.
 */
import type { FunnelStage } from "@/lib/brain-data";

/** Paleta Velox — do dourado (topo) ao navy profundo (base). */
const PALETTE: { light: string; mid: string; dark: string; ink: string }[] = [
  { light: "#F4DFA6", mid: "#D8B45C", dark: "#A9862F", ink: "#2A1F06" },
  { light: "#E7D19A", mid: "#C3A257", dark: "#8E7228", ink: "#241B06" },
  { light: "#BFC9DE", mid: "#8496BC", dark: "#4E5F86", ink: "#101A2E" },
  { light: "#96A9CE", mid: "#5D77A8", dark: "#324A78", ink: "#0B1428" },
  { light: "#6E88BA", mid: "#3D5B93", dark: "#22375F", ink: "#F4F7FF" },
  { light: "#405F9B", mid: "#22406F", dark: "#132646", ink: "#F4F7FF" },
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
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
      <div className="mb-6">
        <h2 className="font-display text-lg">Funil comercial</h2>
        <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
          Da captação ao faturamento — conversão real entre etapas
        </p>
      </div>

      <div
        className="mx-auto w-full max-w-2xl pb-6"
        style={{ perspective: "1100px" }}
      >
        {stages.map((s, i) => {
          const tone = PALETTE[i % PALETTE.length];
          const isRevenue = s.id === "revenue";
          const wTop = 100 - i * (58 / Math.max(n - 1, 1));
          const wBottom = 100 - (i + 1) * (58 / Math.max(n - 1, 1));
          const pct = top > 0 ? (s.value / top) * 100 : 0;
          const insetB = ((wTop - wBottom) / wTop) * 50;

          return (
            <div
              key={s.id}
              className="relative mx-auto"
              style={{ width: `${wTop}%`, marginBottom: 14 }}
            >
              {/* Disco superior — dá a sensação tridimensional da peça */}
              <div
                aria-hidden
                className="absolute left-0 right-0"
                style={{
                  top: -11,
                  height: 22,
                  borderRadius: "50%",
                  background: `linear-gradient(180deg, ${tone.light} 0%, ${tone.mid} 100%)`,
                  boxShadow: `inset 0 -2px 6px rgba(0,0,0,0.22)`,
                }}
              />

              {/* Corpo afunilado da peça */}
              <div
                className="relative h-[74px] w-full"
                style={{
                  clipPath: `polygon(0% 0%, 100% 0%, ${100 - insetB}% 100%, ${insetB}% 100%)`,
                  background: `linear-gradient(90deg, ${tone.dark} 0%, ${tone.mid} 26%, ${tone.light} 48%, ${tone.mid} 72%, ${tone.dark} 100%)`,
                  boxShadow: "0 14px 22px -14px rgba(0,0,0,0.65)",
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0.28) 100%)",
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                  <span
                    className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.18em]"
                    style={{ color: tone.ink, opacity: 0.85 }}
                  >
                    {s.label}
                  </span>
                  <span
                    className="font-display text-[17px] md:text-[19px] leading-tight tabular-nums"
                    style={{ color: tone.ink }}
                  >
                    {isRevenue ? brl(s.value) : s.value.toLocaleString("pt-BR")}
                  </span>
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: tone.ink, opacity: 0.75 }}
                  >
                    {pct.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
              </div>

              {/* Disco inferior em sombra — separa visualmente os níveis */}
              <div
                aria-hidden
                className="absolute mx-auto"
                style={{
                  left: `${insetB}%`,
                  right: `${insetB}%`,
                  bottom: -9,
                  height: 18,
                  borderRadius: "50%",
                  background: `linear-gradient(180deg, ${tone.dark} 0%, rgba(0,0,0,0.55) 100%)`,
                  filter: "blur(0.2px)",
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
