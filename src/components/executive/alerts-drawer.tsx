/**
 * Central de Alertas — Drawer lateral FLUTUANTE e GLOBAL do Workspace.
 *
 * Regras oficiais (Prompt 6E):
 *  • fixo na lateral direita, acompanha toda a rolagem da página;
 *  • pode ser expandido e recolhido, sem trocar de rota;
 *  • nunca substitui conteúdo nem abre nova página;
 *  • atualiza automaticamente a cada evento do sistema.
 *
 * Disponível em todas as telas do Workspace — exceto o KPI Manager.
 */
import { useEffect, useState } from "react";
import { Bell, BellRing, ChevronRight, ExternalLink, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  archiveWorkspaceAlert,
  listWorkspaceAlerts,
  markWorkspaceAlertsRead,
  runWorkspaceAlertEvaluation,
  unreadWorkspaceAlerts,
  WORKSPACE_ALERT_CATEGORY_LABEL,
  type WorkspaceAlert,
} from "@/lib/workspace-alerts";
import { onEvent } from "@/lib/events/bus";
import type { ExecutiveSession } from "@/lib/executive-auth";
import { cn } from "@/lib/utils";

export function AlertsDrawer({ session }: { session: ExecutiveSession }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);
  const [unread, setUnread] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      runWorkspaceAlertEvaluation(session);
      setAlerts(listWorkspaceAlerts(session));
      setUnread(unreadWorkspaceAlerts(session).length);
    }
    refresh();
    // Atualização automática: qualquer evento do barramento re-avalia os alertas
    // (novo lead, lead atualizado, retorno do investidor, reuniões, operacionais).
    const off = onEvent(() => refresh());
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [session]);

  function handleArchive(id: string) {
    archiveWorkspaceAlert(id);
    setAlerts(listWorkspaceAlerts(session));
    setUnread(unreadWorkspaceAlerts(session).length);
  }

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        // Abrir = leitura: a animação para imediatamente e o contador zera.
        markWorkspaceAlertsRead(session);
        setUnread(0);
      }
      return next;
    });
  }

  const pulsing = !open && unread > 0;

  return (
    <div className="pointer-events-none fixed right-0 top-1/2 z-[70] -translate-y-1/2">
      <div className="pointer-events-auto flex items-start">
        {/* Aba fixa — sempre visível, acompanha a rolagem */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Central de Alertas"
          aria-expanded={open}
          className={cn(
            "relative flex h-24 w-9 flex-col items-center justify-center gap-1 rounded-l-2xl border border-r-0",
            "border-[color:var(--border)] bg-[color:var(--navy)]/95 backdrop-blur shadow-xl transition",
            "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40",
            open && "text-[color:var(--gold)]",
            pulsing && "alert-pulse border-[color:var(--gold)]/50 text-[color:var(--gold)]",
          )}
        >
          {open ? (
            <ChevronRight className="h-4 w-4" />
          ) : pulsing ? (
            <BellRing className="h-4 w-4 text-[color:var(--gold)]" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          <span className="text-[9px] uppercase tracking-[0.2em] [writing-mode:vertical-rl] rotate-180">
            Alertas
          </span>
          {unread > 0 && !open && (
            <span className="absolute -left-1.5 top-2 min-w-[16px] h-[16px] rounded-full bg-[color:var(--gold)] text-[10px] font-medium text-[color:var(--navy-deep)] flex items-center justify-center px-1">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Painel — expande/recolhe sem alterar rota */}
        <div
          className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 ease-out",
            open ? "w-[min(360px,92vw)] opacity-100" : "w-0 opacity-0",
          )}
        >
          <div className="flex max-h-[78vh] w-[min(360px,92vw)] flex-col rounded-l-2xl border border-r-0 border-[color:var(--border)] bg-[color:var(--navy)]/98 backdrop-blur shadow-2xl">
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
                aria-label="Recolher"
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
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label="Arquivar"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(a.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  handleArchive(a.id);
                                }
                              }}
                              className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </span>
                          </div>
                          {expanded && (
                            <div className="mt-2.5 border-t border-[color:var(--border)]/60 pt-2.5">
                              <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
                                {a.description}
                              </p>
                              {a.investorId ? (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpen(false);
                                    void navigate({
                                      to: "/executivo/dashboard",
                                      search: { perfil: a.investorId },
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.stopPropagation();
                                      setOpen(false);
                                      void navigate({
                                        to: "/executivo/dashboard",
                                        search: { perfil: a.investorId },
                                      });
                                    }
                                  }}
                                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--gold)]/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
                                >
                                  <ExternalLink className="h-3 w-3 text-[color:var(--gold)]" /> Abrir card
                                </span>
                              ) : null}
                            </div>
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
      </div>
    </div>
  );
}
