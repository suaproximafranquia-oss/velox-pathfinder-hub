import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Check,
  Copy,
  ExternalLink,
  LineChart,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  buildSnapshot,
  dismissAlert,
  loadAlerts,
  PERIOD_OPTIONS,
  PRIORITY_LABEL,
  type BrainAlert,
  type BrainPeriod,
  type FunnelStage,
  type SeriesPoint,
} from "@/lib/brain-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/brain")({
  head: () => ({
    meta: [
      { title: "Brain Analytics — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BrainPage,
});

function BrainPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [period, setPeriod] = useState<BrainPeriod>(30);
  const [alerts, setAlerts] = useState<BrainAlert[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
    setAlerts(loadAlerts());
  }, [navigate]);

  const snapshot = useMemo(() => buildSnapshot(period), [period]);
  const activeAlerts = alerts.filter((a) => !a.dismissed);

  if (!session) return null;

  function handleDismiss(id: string) {
    setAlerts(dismissAlert(id));
  }

  async function handleCopy(a: BrainAlert) {
    const text = `${a.title}\n${a.description}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(a.id);
      setTimeout(() => setCopiedId((c) => (c === a.id ? null : c)), 1500);
    } catch {
      /* silencioso */
    }
  }

  return (
    <ExecutiveShell session={session} title="Brain Analytics">
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          <span className="uppercase tracking-[0.22em]">
            Indicadores executivos · dados simulados
          </span>
        </div>
        <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 p-1 text-xs">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full transition",
                period === opt.value
                  ? "bg-[color:var(--accent)] text-[color:var(--foreground)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot.kpis.map((k) => {
          const up = k.delta >= 0;
          return (
            <div
              key={k.id}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4"
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                {k.label}
              </p>
              <p className="font-display text-2xl mt-2">{k.value}</p>
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-1 text-[11px]",
                  up ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {up ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(k.delta).toFixed(1)}% vs período anterior
              </div>
              {k.hint && (
                <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">
                  {k.hint}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Funil + Alertas */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <FunnelCard stages={snapshot.funnel} />
        <AlertsCenter
          alerts={activeAlerts}
          copiedId={copiedId}
          onDismiss={handleDismiss}
          onCopy={handleCopy}
        />
      </div>

      {/* Gráficos */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Conversão por etapa"
          icon={Activity}
          subtitle="Percentual de aproveitamento entre etapas do funil"
          data={snapshot.conversion}
          unit="%"
        />
        <ChartCard
          title="Evolução acumulada"
          icon={TrendingUp}
          subtitle="Volume acumulado no período"
          data={snapshot.evolution}
        />
        <ChartCard
          title="Distribuição temporal"
          icon={LineChart}
          subtitle="Volume diário"
          data={snapshot.temporal}
        />
        <ChartCard
          title="Tendência projetada"
          icon={Sparkles}
          subtitle="Projeção suavizada sobre o período"
          data={snapshot.trend}
        />
      </div>

      <p className="mt-10 text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
        Todos os valores exibidos nesta versão são simulados. O Brain
        permanecerá desacoplado até a habilitação de conectores externos.
      </p>
    </ExecutiveShell>
  );
}

function FunnelCard({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.value));
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg">Funil executivo</h2>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Visão consolidada
        </span>
      </div>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const width = (s.value / max) * 100;
          const prev = i === 0 ? s.value : stages[i - 1].value;
          const rate = i === 0 ? 100 : (s.value / Math.max(prev, 1)) * 100;
          return (
            <div key={s.id} className="group">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[color:var(--foreground)]">{s.label}</span>
                <span className="text-[color:var(--muted-foreground)]">
                  {s.value.toLocaleString("pt-BR")}
                  {i > 0 && (
                    <span className="ml-2 text-[color:var(--gold)]">
                      {rate.toFixed(0)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-8 rounded-md bg-[color:var(--border)]/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[color:var(--gold)]/80 to-[color:var(--gold)]/30"
                  style={{ width: `${Math.max(width, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertsCenter({
  alerts,
  copiedId,
  onDismiss,
  onCopy,
}: {
  alerts: BrainAlert[];
  copiedId: string | null;
  onDismiss: (id: string) => void;
  onCopy: (a: BrainAlert) => void;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-[color:var(--gold)]" />
          <h2 className="font-display text-lg">Central de Alertas</h2>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          {alerts.length} ativos
        </span>
      </div>
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] p-6 text-center text-xs text-[color:var(--muted-foreground)]">
          Nenhum alerta pendente no momento.
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--navy-deep)]/40 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <PriorityDot priority={a.priority} />
                  <div>
                    <p className="text-sm text-[color:var(--foreground)] leading-snug">
                      {a.title}
                    </p>
                    <p className="text-xs text-[color:var(--muted-foreground)] mt-1">
                      {a.description}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mt-2">
                      {PRIORITY_LABEL[a.priority]} ·{" "}
                      {new Date(a.date).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <AlertBtn
                  onClick={() => window.alert(`${a.title}\n\n${a.description}`)}
                  icon={ExternalLink}
                >
                  Abrir
                </AlertBtn>
                <AlertBtn
                  onClick={() => onCopy(a)}
                  icon={copiedId === a.id ? Check : Copy}
                >
                  {copiedId === a.id ? "Copiado" : "Copiar"}
                </AlertBtn>
                <AlertBtn onClick={() => onDismiss(a.id)} icon={X}>
                  Fechar
                </AlertBtn>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[10px] text-[color:var(--muted-foreground)] leading-relaxed">
        Alertas permanecem visíveis até serem fechados manualmente.
      </p>
    </div>
  );
}

function PriorityDot({ priority }: { priority: BrainAlert["priority"] }) {
  const color =
    priority === "alta"
      ? "bg-rose-400"
      : priority === "media"
        ? "bg-amber-400"
        : "bg-emerald-400";
  return (
    <span className="mt-1 relative flex h-2 w-2">
      <span
        className={cn(
          "absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping",
          color,
        )}
      />
      <span className={cn("relative inline-flex rounded-full h-2 w-2", color)} />
    </span>
  );
}

function AlertBtn({
  onClick,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  data,
  unit,
}: {
  title: string;
  subtitle: string;
  icon: typeof LineChart;
  data: SeriesPoint[];
  unit?: string;
}) {
  const max = Math.max(...data.map((d) => d.y), 1);
  const min = Math.min(...data.map((d) => d.y), 0);
  const w = 600;
  const h = 160;
  const pad = 12;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const norm = (v: number) =>
    h - pad - ((v - min) / Math.max(max - min, 1)) * (h - pad * 2);

  const points = data.map((d, i) => [pad + i * step, norm(d.y)] as const);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${path} L${points[points.length - 1]?.[0].toFixed(1) ?? pad},${h - pad} L${pad},${h - pad} Z`;

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[color:var(--gold)]" />
          <h3 className="font-display text-base">{title}</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Máx {max}
          {unit ?? ""}
        </span>
      </div>
      <p className="text-xs text-[color:var(--muted-foreground)] mb-3">{subtitle}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
        <defs>
          <linearGradient id={`grad-${title}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${title})`} />
        <path
          d={path}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="1.8" fill="var(--gold)" />
        ))}
      </svg>
    </div>
  );
}