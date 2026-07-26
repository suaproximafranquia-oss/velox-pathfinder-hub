import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  FileCheck,
  Handshake,
  Info,
  Sparkles,
  Trophy,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrainKpi } from "@/lib/brain-data";

const ICONS: Record<BrainKpi["icon"], LucideIcon> = {
  users: Users,
  sparkles: Sparkles,
  video: Video,
  fileCheck: FileCheck,
  handshake: Handshake,
  trophy: Trophy,
  activity: Activity,
  clock: Clock,
};

export function KpiCard({ kpi, loading = false }: { kpi: BrainKpi; loading?: boolean }) {
  const Icon = ICONS[kpi.icon];
  const up = kpi.delta >= 0;

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5 animate-pulse">
        <div className="h-8 w-8 rounded-lg bg-[color:var(--border)]/60 mb-4" />
        <div className="h-3 w-24 bg-[color:var(--border)]/60 rounded mb-3" />
        <div className="h-6 w-20 bg-[color:var(--border)]/60 rounded mb-3" />
        <div className="h-2 w-32 bg-[color:var(--border)]/40 rounded" />
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5 hover:border-[color:var(--gold)]/40 hover:bg-[color:var(--card)]/60 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <span
          className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
          title={kpi.tooltip}
        >
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
        {kpi.label}
      </p>
      <p className="font-display text-2xl mt-1.5">{kpi.value}</p>
      <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
        {kpi.description}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
            up
              ? "bg-emerald-400/10 text-emerald-300"
              : "bg-rose-400/10 text-rose-300",
          )}
        >
          {up ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(kpi.delta).toFixed(1)}%
        </span>
        <span className="text-[10px] text-[color:var(--muted-foreground)]">
          vs periodo anterior
        </span>
      </div>
    </div>
  );
}
