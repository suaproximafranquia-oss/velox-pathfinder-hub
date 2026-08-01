/**
 * Campanha Velox — representação visual do progresso do executivo.
 *
 * Escopo desta sprint: apenas o visual (barra + badge + números).
 * A arquitetura fica preparada para receber futuramente o sistema de
 * reconhecimento, conquistas, pop-ups, confetes, aniversários e o
 * histórico de conquistas, sem alteração da API deste componente.
 */
import { Trophy } from "lucide-react";
import {
  CAMPAIGN_LEVELS,
  CAMPAIGN_MAX,
  campaignStatus,
  formatCurrency,
} from "@/lib/kpi-manager";
import { cn } from "@/lib/utils";

export function CampanhaVeloxCard({ salesValue }: { salesValue: number }) {
  const { value, percent, level } = campaignStatus(salesValue);
  const barColor = level?.color ?? "rgba(148, 163, 184, 0.55)"; // slate-400/55 neutro
  // Trilho mais claro e preenchimento com brilho — leitura imediata.
  const trackColor = "rgba(226, 232, 240, 0.38)";
  const percentLabel = `${percent.toFixed(1).replace(".", ",")}%`;
  const nextLevel = CAMPAIGN_LEVELS.find((l) => value < l.min) ?? null;
  const remaining = nextLevel ? Math.max(0, nextLevel.min - value) : 0;
  const isSupreme = level?.key === "supreme";

  return (
    <section
      aria-label="Campanha Velox"
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)] shrink-0">
            <Trophy className="h-3.5 w-3.5" strokeWidth={1.6} />
          </span>
          <h3 className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)] truncate">
            Campanha Velox
          </h3>
        </div>
        {level ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
            style={{
              borderColor: `${level.color}55`,
              backgroundColor: `${level.color}18`,
              color: level.color,
            }}
          >
            <span aria-hidden>{level.emoji}</span>
            <span className="text-[color:var(--foreground)]/90">{level.label}</span>
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]/70">
            Em progressão
          </span>
        )}
      </header>

      <div className="mt-4">
        <div
          className="relative h-7 w-full overflow-hidden rounded-full border border-white/45"
          style={{
            backgroundColor: trackColor,
            boxShadow:
              "inset 0 2px 6px rgba(0,0,0,0.42), 0 1px 0 rgba(255,255,255,0.18)",
          }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={CAMPAIGN_MAX}
          aria-valuenow={Math.round(value)}
          aria-valuetext={percentLabel}
        >
          <div
            className={cn(
              "h-full rounded-full",
              "transition-[width,background-color] duration-700 ease-out",
            )}
            style={{
              width: `${percent}%`,
              backgroundImage:
                `linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 52%, rgba(0,0,0,0.18) 100%),` +
                `linear-gradient(90deg, ${barColor} 0%, ${barColor} 62%, rgba(255,255,255,0.62) 100%)`,
              backgroundColor: barColor,
              boxShadow: `0 0 24px -3px ${barColor}, inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 2px rgba(0,0,0,0.28)`,
            }}
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 px-2">
            <span className="rounded-full bg-black/75 px-2.5 py-[2px] text-[11px] font-semibold tabular-nums tracking-wide text-white shadow-[0_1px_5px_rgba(0,0,0,0.7)]">
              {percentLabel}
            </span>
            {level ? (
              <span
                className="rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
                style={{
                  backgroundColor: `${level.color}E6`,
                  border: `1px solid rgba(255,255,255,0.35)`,
                }}
              >
                {level.label}
              </span>
            ) : null}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Acumulado
          </span>
          <div className="flex items-baseline gap-3 tabular-nums">
            <span className="text-[color:var(--foreground)] font-medium">
              {formatCurrency(value)}
            </span>
            <span className="text-[11px] text-[color:var(--muted-foreground)]">
              {percentLabel} de {formatCurrency(CAMPAIGN_MAX)}
            </span>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
          {isSupreme
            ? "Nível máximo da campanha atingido."
            : nextLevel
              ? `Faltam ${formatCurrency(remaining)} para atingir ${nextLevel.label}.`
              : ""}
        </p>
      </div>
    </section>
  );
}