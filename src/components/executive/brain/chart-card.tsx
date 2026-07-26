import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { SeriesPoint } from "@/lib/brain-data";

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  data,
  unit,
  action,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  data: SeriesPoint[];
  unit?: string;
  action?: ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const hasData = data.length > 0;
  const max = Math.max(...data.map((d) => d.y), 1);
  const min = Math.min(...data.map((d) => d.y), 0);
  const w = 600;
  const h = 180;
  const pad = 16;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const norm = (v: number) =>
    h - pad - ((v - min) / Math.max(max - min, 1)) * (h - pad * 2);

  const points = data.map((d, i) => [pad + i * step, norm(d.y)] as const);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const area = hasData
    ? `${path} L${points[points.length - 1][0].toFixed(1)},${h - pad} L${pad},${h - pad} Z`
    : "";

  const gradId = `grad-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[color:var(--gold)]" strokeWidth={1.6} />
          <h3 className="font-display text-base">{title}</h3>
        </div>
        {action ?? (
          <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Max {max}
            {unit ?? ""}
          </span>
        )}
      </div>
      <p className="text-xs text-[color:var(--muted-foreground)] mb-4">{subtitle}</p>

      {!hasData ? (
        <EmptyChart />
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-44"
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((t) => (
              <line
                key={t}
                x1={pad}
                x2={w - pad}
                y1={pad + (h - pad * 2) * t}
                y2={pad + (h - pad * 2) * t}
                stroke="var(--border)"
                strokeDasharray="2 4"
                strokeOpacity="0.5"
              />
            ))}
            <path d={area} fill={`url(#${gradId})`} />
            <path
              d={path}
              fill="none"
              stroke="var(--gold)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-[stroke-dashoffset] duration-500"
            />
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p[0]}
                  cy={p[1]}
                  r={hover === i ? 3.5 : 1.8}
                  fill="var(--gold)"
                  className="transition-all"
                />
                <rect
                  x={p[0] - step / 2}
                  y={0}
                  width={step || 20}
                  height={h}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            ))}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-[color:var(--border)] bg-[color:var(--navy)] px-2.5 py-1.5 text-[11px] shadow-lg"
              style={{
                left: `${(points[hover][0] / w) * 100}%`,
                top: `${(points[hover][1] / h) * 100}%`,
              }}
            >
              <div className="text-[color:var(--muted-foreground)] text-[10px]">
                {data[hover].x}
              </div>
              <div className="text-[color:var(--foreground)] tabular-nums">
                {data[hover].y}
                {unit ?? ""}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-[10px] text-[color:var(--muted-foreground)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-[color:var(--gold)]" />
          {title}
        </span>
        {hasData && (
          <span>
            Min {min}
            {unit ?? ""} | Max {max}
            {unit ?? ""}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-44 rounded-xl border border-dashed border-[color:var(--border)] flex items-center justify-center text-xs text-[color:var(--muted-foreground)]">
      Sem dados no periodo selecionado
    </div>
  );
}
