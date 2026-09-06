/**
 * Central de Alertas — repositório permanente.
 *
 * DF 2.4.2: a Central deixa de ser um ambiente operacional. Aqui nenhum
 * alerta é excluído ou arquivado — apenas consultado.
 *
 * ETAPA 1 (servidor como fonte de verdade): os alertas exibidos são
 * derivados exclusivamente de tabelas do servidor (portal_leads,
 * portal_journey_events, portal_engagement, portal_meetings e
 * lead_ownership_history). Nenhum estado de navegador
 * (`atlas:workspace-alerts:v1`, `velox:journey:v1`, `velox:events:v1`,
 * base local de leads) participa da geração de alertas reais.
 *
 * "Contato Solicitado" não é gerado nesta etapa: ainda não existe
 * registro server-side desse pedido.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Search, Mail, Phone, Tag } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  listServerWorkspaceAlerts,
  type ServerWorkspaceAlert,
} from "@/lib/workspace-alerts.functions";
import { WORKSPACE_ALERT_CATEGORY_LABEL } from "@/lib/workspace-alerts";
import { cn } from "@/lib/utils";

function digits(value: string): string {
  return value.replace(/\D+/g, "");
}


export const Route = createFileRoute("/f/executivo/alertas")({
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
  const [alerts, setAlerts] = useState<ServerWorkspaceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/f/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoading(true);
    listServerWorkspaceAlerts()
      .then((rows) => {
        if (alive) setAlerts(rows);
      })
      .catch(() => {
        if (alive) setAlerts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  const visible = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return alerts;
    const num = digits(raw);
    return alerts.filter((a) => {
      const hay = [
        a.title,
        a.description,
        WORKSPACE_ALERT_CATEGORY_LABEL[a.category],
        a.investorName,
        a.investorEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(raw)) return true;
      // Pesquisa parcial por WhatsApp: "9988" localiza o número completo.
      if (num.length >= 2 && a.investorWhatsapp && digits(a.investorWhatsapp).includes(num)) {
        return true;
      }
      return false;
    });
  }, [alerts, query]);


  const active = useMemo(() => visible.filter((a) => !a.archived), [visible]);
  const resolved = useMemo(() => visible.filter((a) => a.archived), [visible]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Alertas">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
          <BellRing className="h-4 w-4" />
        </span>
        <div>
          <h1 className="font-display text-xl">Repositório de alertas</h1>
          <p className="text-xs text-[color:var(--muted-foreground)] mt-1 max-w-2xl">
            Registro institucional permanente de todos os alertas gerados pelo
            ecossistema. Nenhum alerta é excluído: quando deixa de ser ativo,
            apenas muda de status. A operação acontece no CRM.
          </p>
        </div>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou WhatsApp"
            className="w-64 bg-transparent text-xs outline-none placeholder:text-[color:var(--muted-foreground)]"
          />
        </label>
      </div>

      <Section title="Ativos" count={active.length} items={active} contacts={contacts} />
      <div className="mt-8">
        <Section title="Resolvidos" count={resolved.length} items={resolved} contacts={contacts} />
      </div>
    </ExecutiveShell>
  );
}

function Section({
  title,
  count,
  items,
  contacts,
}: {
  title: string;
  count: number;
  items: WorkspaceAlert[];
  contacts: Map<string, AlertContact>;
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
          {items.map((a) => {
            const c = a.investorId ? contacts.get(a.investorId) : undefined;
            return (
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
                  {c && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--muted-foreground)]">
                      <span className="text-[color:var(--foreground)]">{c.name}</span>
                      {c.whatsapp && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone className="h-3 w-3" />
                          {c.whatsapp}
                        </span>
                      )}
                      {c.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {c.origin}
                      </span>
                    </div>
                  )}
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
                  <span className="inline-flex items-center rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    {a.archived ? "Resolvido" : "Ativo"}
                  </span>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
