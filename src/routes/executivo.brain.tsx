import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarRange,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  UserSquare2,
  X,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  buildOperationalSnapshot,
  CATEGORY_LABEL,
  dismissAlert,
  loadAlerts,
  PRIORITY_LABEL,
  visibleAlertsFor,
  type BrainAlert,
} from "@/lib/brain-data";
import {
  availableScopes,
  defaultScope,
  SCOPE_LABEL,
  type ScopeMode,
  type ScopeSelection,
} from "@/lib/brain/scopes";
import { AVAILABLE_MONTHS, DEFAULT_MONTH_KEY } from "@/lib/kpi-manager";
import { visibleCollaborators } from "@/lib/teams";
import { KpiCard } from "@/components/executive/brain/kpi-card";
import { FunnelCard } from "@/components/executive/brain/funnel-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/brain")({
  head: () => ({
    meta: [
      { title: "Brain Analytics — Atlas Platform" },
      {
        name: "description",
        content:
          "Painel executivo com indicadores principais, funil operacional e alertas do KPI Manager.",
      },
      { property: "og:title", content: "Brain Analytics — Atlas Platform" },
      {
        property: "og:description",
        content:
          "Painel executivo com indicadores principais, funil operacional e alertas do KPI Manager.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BrainPage,
});

function BrainPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [monthKey, setMonthKey] = useState(DEFAULT_MONTH_KEY);
  const [scope, setScope] = useState<ScopeSelection | null>(null);
  const [alerts, setAlerts] = useState<BrainAlert[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
    setScope(defaultScope(s.activeRole, s.userId));
    setAlerts(loadAlerts());
  }, [navigate]);

  const snapshot = useMemo(
    () => (session && scope ? buildOperationalSnapshot(session, scope, monthKey) : null),
    [session, scope, monthKey],
  );

  if (!session || !scope || !snapshot) return null;

  const activeAlerts = visibleAlertsFor(session, scope).filter((a) => !a.dismissed);
  const scopes = availableScopes(session.activeRole);
  const executives = visibleCollaborators(session);
  const canDismissAlerts = session.activeRole === "executivo";

  function handleDismiss(id: string) {
    if (!session || !canDismissAlerts) return;
    setAlerts(dismissAlert(id, session.userId));
  }

  function chooseScope(mode: ScopeMode) {
    if (!session) return;
    if (mode === "executive") {
      setScope({ mode, executiveId: executives[0]?.id ?? session.userId });
      return;
    }
    setScope({ mode });
  }

  async function handleCopy(a: BrainAlert) {
    try {
      await navigator.clipboard.writeText(a.copyTemplate);
      setCopiedId(a.id);
      setTimeout(() => setCopiedId((c) => (c === a.id ? null : c)), 1500);
    } catch {
      /* silencioso */
    }
  }

  return (
    <ExecutiveShell session={session} title="Brain Analytics">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {scopes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => chooseScope(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                scope.mode === m
                  ? "border-[color:var(--gold)]/40 bg-[color:var(--accent)] text-[color:var(--foreground)]"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              )}
            >
              {SCOPE_LABEL[m]}
            </button>
          ))}
          {scope.mode === "executive" && (
            <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-1.5 text-xs">
              <UserSquare2 className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
              <select
                value={scope.executiveId ?? session.userId}
                onChange={(e) => setScope({ mode: "executive", executiveId: e.target.value })}
                className="bg-transparent outline-none text-[color:var(--foreground)]"
              >
                {executives.map((e) => (
                  <option key={e.id} value={e.id} className="bg-[color:var(--navy)]">
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-1.5 text-xs">
          <CalendarRange className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
          <select
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="bg-transparent outline-none text-[color:var(--foreground)]"
          >
            {AVAILABLE_MONTHS.map((m) => (
              <option key={m.key} value={m.key} className="bg-[color:var(--navy)]">
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ScopeBreadcrumb mode={scope.mode} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <FunnelCard stages={snapshot.funnel} />
        <AlertsCenter
          alerts={activeAlerts}
          copiedId={copiedId}
          canDismiss={canDismissAlerts}
          onDismiss={handleDismiss}
          onCopy={handleCopy}
        />
      </div>

      <p className="mt-10 text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
        Os indicadores desta tela consomem exclusivamente o KPI Manager. O Brain
        prioriza decisões operacionais rápidas: volume, funil e alertas acionáveis.
      </p>
    </ExecutiveShell>
  );
}

function ScopeBreadcrumb({ mode }: { mode: ScopeMode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
      <span>Escopo</span>
      <ChevronDown className="h-3 w-3 -rotate-90" />
      <span className="text-[color:var(--gold)]">{SCOPE_LABEL[mode]}</span>
    </div>
  );
}

function AlertsCenter({
  alerts,
  copiedId,
  canDismiss,
  onDismiss,
  onCopy,
}: {
  alerts: BrainAlert[];
  copiedId: string | null;
  canDismiss: boolean;
  onDismiss: (id: string) => void;
  onCopy: (a: BrainAlert) => void;
}) {
  return (
    <div
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-5 flex flex-col"
      style={{ height: "min(560px, calc(100vh - 220px))" }}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-[color:var(--gold)]" />
          <h2 className="font-display text-lg">Central de Alertas</h2>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          {alerts.length} ativos
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto kpi-scroll pr-1 -mr-1">
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] p-6 text-center text-xs text-[color:var(--muted-foreground)]">
          Nenhum alerta pendente no momento.
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--navy-deep)]/40 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <PriorityDot priority={a.priority} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                        {CATEGORY_LABEL[a.category]}
                      </span>
                      <span className="text-[9px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                        {PRIORITY_LABEL[a.priority]}
                      </span>
                    </div>
                    <p className="text-sm text-[color:var(--foreground)] leading-snug mt-1.5">
                      {a.title}
                    </p>
                    <p className="text-xs text-[color:var(--muted-foreground)] mt-1">
                      {a.description}
                    </p>
                    <p className="text-[10px] text-[color:var(--muted-foreground)] mt-2">
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
                  onClick={() =>
                    window.alert(
                      "Em breve: acao direta a partir deste alerta.",
                    )
                  }
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
                {canDismiss && (
                  <AlertBtn onClick={() => onDismiss(a.id)} icon={X}>
                    Fechar
                  </AlertBtn>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
      <p className="mt-4 text-[10px] text-[color:var(--muted-foreground)] leading-relaxed shrink-0">
        Alertas pertencem ao executivo responsável. Apenas o próprio executivo pode encerrá-los.
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
  icon: typeof Copy;
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
