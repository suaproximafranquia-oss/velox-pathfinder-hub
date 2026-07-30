/**
 * Central de Alertas — histórico completo.
 *
 * Consome exatamente a mesma fonte de dados do Drawer lateral
 * (`src/lib/workspace-alerts.ts`). O Drawer mostra o tempo real;
 * esta tela mostra o histórico, inclusive alertas arquivados.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Archive } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { onEvent } from "@/lib/events/bus";
import {
  archiveWorkspaceAlert,
  listWorkspaceAlertHistory,
  runWorkspaceAlertEvaluation,
  WORKSPACE_ALERT_CATEGORY_LABEL,
  type WorkspaceAlert,
} from "@/lib/workspace-alerts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/alertas")({
  head: () => ({
    meta: [
      { title: "Central de Alertas — Atlas Platform" },
      {
        name: "description",
        content:
          "Histórico completo dos alertas operacionais e comerciais do executivo no workspace.",
      },
      { property: "og:title", content: "Central de Alertas — Atlas Platform" },
      {
        property: "og:description",
        content: "Histórico completo dos alertas do workspace executivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlertsCenterPage,
});

function AlertsCenterPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    function refresh() {
      runWorkspaceAlertEvaluation(session!);
      setAlerts(listWorkspaceAlertHistory(session!));
    }
    refresh();
    return onEvent(() => refresh());
  }, [session]);

  const active = useMemo(() => alerts.filter((a) => !a.archived), [alerts]);
  const archived = useMemo(() => alerts.filter((a) => a.archived), [alerts]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Alertas">
      <div className="mb-6 flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
          <BellRing className="h-4 w-4" />
        </span>
        <div>
          <h1 className="font-display text-xl">Histórico de alertas</h1>
          <p className="text-xs text-[color:var(--muted-foreground)] mt-1 max-w-2xl">
            Mesma base do Drawer lateral. Aqui ficam registrados todos os alertas —
            ativos e arquivados — do seu workspace.
          </p>
        </div>
      </div>

      <Section
        title="Ativos"
        count={active.length}
        items={active}
        onArchive={(id) => {
          archiveWorkspaceAlert(id);
          setAlerts(listWorkspaceAlertHistory(session));
        }}
      />
      <div className="mt-8">
        <Section title="Arquivados" count={archived.length} items={archived} />
      </div>
    </ExecutiveShell>
  );
}

function Section({
  title,
  count,
  items,
  onArchive,
}: {
  title: string;
  count: number;
  items: WorkspaceAlert[];
  onArchive?: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          {title}
        </h2>
        <span className="text-[10px] text-[color:var(--muted-foreground)]/70">{count}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-6 text-center text-xs text-[color:var(--muted-foreground)]">
          Nenhum alerta nesta seção.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((a) => (
            <li
              key={a.id}
              className={cn(
                "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3",
                a.archived && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    {WORKSPACE_ALERT_CATEGORY_LABEL[a.category]}
                  </span>
                  <p className="mt-1.5 text-sm leading-snug">{a.title}</p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)] leading-relaxed">
                    {a.description}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
                    {new Date(a.date).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {onArchive ? (
                    <button
                      type="button"
                      onClick={() => onArchive(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[10px] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40"
                    >
                      <Archive className="h-3 w-3" /> Arquivar
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
