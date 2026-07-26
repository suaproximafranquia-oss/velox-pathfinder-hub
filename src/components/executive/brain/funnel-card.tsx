import type { FunnelStage } from "@/lib/brain-data";

export function FunnelCard({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-lg">Funil executivo</h2>
          <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
            Volume operacional por etapa
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Visao consolidada
        </span>
      </div>
      <div className="space-y-3">
        {stages.map((s) => {
          const width = (s.value / max) * 100;
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[color:var(--foreground)]">{s.label}</span>
                <span className="flex items-center gap-3 text-[color:var(--muted-foreground)]">
                  <span className="tabular-nums">
                    {s.value.toLocaleString("pt-BR")}
                  </span>
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[color:var(--border)]/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--gold)]/90 to-[color:var(--gold)]/40 transition-[width] duration-500"
                  style={{ width: `${Math.max(width, 3)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
