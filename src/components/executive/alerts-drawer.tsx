/**
 * Central de Alertas — painel lateral GLOBAL do Workspace.
 * Nunca navega para outra página: preserva o contexto do executivo.
 * Duas categorias apenas: Movimentação do Investidor e Lembretes de Reunião.
 * Interação simples: clique expande/recolhe, X arquiva.
 */
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  archiveWorkspaceAlert,
  listWorkspaceAlerts,
  runWorkspaceAlertEvaluation,
  WORKSPACE_ALERT_CATEGORY_LABEL,
  type WorkspaceAlert,
} from "@/lib/workspace-alerts";
import { onEvent } from "@/lib/events/bus";
import type { ExecutiveSession } from "@/lib/executive-auth";
import { cn } from "@/lib/utils";

export function AlertsDrawer({ session }: { session: ExecutiveSession }) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    runWorkspaceAlertEvaluation(session);
    setAlerts(listWorkspaceAlerts(session));
    const off = onEvent(() => setAlerts(listWorkspaceAlerts(session)));
    return off;
  }, [session]);

  function handleArchive(id: string) {
    archiveWorkspaceAlert(id);
    setAlerts(listWorkspaceAlerts(session));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Central de Alertas"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
      >
        <Bell className="h-4 w-4" />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-[color:var(--gold)] text-[10px] font-medium text-[color:var(--navy-deep)] flex items-center justify-center px-1">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-[color:var(--navy-deep)]/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-[color:var(--border)] bg-[color:var(--navy)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
              <div>
                <h2 className="font-display text-base">Central de Alertas</h2>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)] mt-0.5">
                  {alerts.length} ativos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto kpi-scroll px-4 py-4">
              {alerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[color:var(--border)] p-6 text-center text-xs text-[color:var(--muted-foreground)]">
                  Nenhum alerta no momento.
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {alerts.map((a) => {
                    const expanded = expandedId === a.id;
                    return (
                      <li
                        key={a.id}
                        className="rounded-xl border border-[color:var(--border)] bg-[color:var(--navy-deep)]/40 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : a.id)}
                          className="w-full text-left px-3.5 py-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="inline-flex items-center rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                {WORKSPACE_ALERT_CATEGORY_LABEL[a.category]}
                              </span>
                              <p className="text-sm text-[color:var(--foreground)] leading-snug mt-1.5 truncate">
                                {a.title}
                              </p>
                              <p className="text-[10px] text-[color:var(--muted-foreground)] mt-1">
                                {new Date(a.date).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label="Arquivar"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(a.id);
                              }}
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {expanded && (
                            <p
                              className={cn(
                                "mt-2.5 text-xs text-[color:var(--muted-foreground)] leading-relaxed border-t border-[color:var(--border)]/60 pt-2.5",
                              )}
                            >
                              {a.description}
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
