/**
 * Green Sales — CRM próprio do Portal Velox.
 *
 * O ambiente externo continua existindo como origem dos leads, mas a
 * operação acontece aqui: estrutura, interface e automação são nossas.
 * Nenhuma informação é enviada de volta à origem nesta versão.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { isCrmAdministrator, isCrmSupervisor } from "@/lib/crm/permissions";
import {
  getCrmLead,
  listCrmLeads,
  listCrmSyncRuns,
  retryCrmWelcome,
  runCrmSyncNow,
  type CrmLeadEventView,
  type CrmLeadView,
  type CrmSyncRunView,
} from "@/lib/crm/leads.functions";

export const Route = createFileRoute("/executivo/greensales")({
  head: () => ({
    meta: [
      { title: "Green Sales — CRM Velox" },
      {
        name: "description",
        content:
          "CRM próprio do Portal Velox: leads recebidos da captação, etapa NOVOS e envio automático do material de boas-vindas.",
      },
      { property: "og:title", content: "Green Sales — CRM Velox" },
      {
        property: "og:description",
        content: "Operação de leads da captação dentro do Portal Velox, com automação de contato.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GreenSalesCrmPage,
});

const WELCOME_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  SENDING: "Enviando",
  SENT: "Enviada",
  FAILED: "Falhou",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "SENT"
      ? "border-emerald-500/40 text-emerald-400"
      : status === "FAILED"
        ? "border-red-500/40 text-red-400"
        : "border-amber-500/40 text-amber-400";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>
      {WELCOME_LABEL[status] ?? status}
    </span>
  );
}

function GreenSalesCrmPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [leads, setLeads] = useState<CrmLeadView[]>([]);
  const [runs, setRuns] = useState<CrmSyncRunView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<CrmLeadEventView[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchLeads = useServerFn(listCrmLeads);
  const fetchRuns = useServerFn(listCrmSyncRuns);
  const fetchLead = useServerFn(getCrmLead);
  const runSync = useServerFn(runCrmSyncNow);
  const retryWelcome = useServerFn(retryCrmWelcome);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  const allowed = session
    ? isCrmAdministrator(session.activeRole) || isCrmSupervisor(session.activeRole)
    : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, history] = await Promise.all([
        fetchLeads({ data: { stageKey: "novos", search } }),
        fetchRuns({}),
      ]);
      setLeads(rows);
      setRuns(history);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao carregar os leads.");
    } finally {
      setLoading(false);
    }
  }, [fetchLeads, fetchRuns, search]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  useEffect(() => {
    if (!selectedId) {
      setEvents([]);
      return;
    }
    void fetchLead({ data: { id: selectedId } }).then((res) => setEvents(res.events));
  }, [fetchLead, selectedId]);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  const totals = useMemo(
    () => ({
      total: leads.length,
      enviadas: leads.filter((l) => l.welcomeStatus === "SENT").length,
      pendentes: leads.filter((l) => l.welcomeStatus === "PENDING").length,
      falhas: leads.filter((l) => l.welcomeStatus === "FAILED").length,
    }),
    [leads],
  );

  async function handleSync() {
    setSyncing(true);
    setNotice(null);
    try {
      const summary = await runSync({});
      setNotice(
        summary.ok
          ? `Sincronização concluída: ${summary.created} novos, ${summary.updated} atualizados, ${summary.welcomeSent} boas-vindas enviadas.`
          : `Sincronização com falha: ${summary.message ?? "erro desconhecido"}.`,
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha na sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleRetry(id: string) {
    setNotice(null);
    const res = await retryWelcome({ data: { id } });
    setNotice(res.ok ? "Mensagem de boas-vindas enviada." : `Envio não concluído (${res.outcome}).`);
    await load();
  }

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Green Sales">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-xl">Green Sales</h1>
            <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
              Leads recebidos da captação, organizados na etapa <strong>NOVOS</strong> do nosso CRM.
              O material de boas-vindas é enviado automaticamente, uma única vez por lead.
            </p>
          </div>
        </div>
        {allowed && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando…" : "Sincronizar agora"}
          </button>
        )}
      </div>

      {!allowed ? (
        <div className="rounded-2xl border border-[color:var(--border)] p-6 text-sm text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mb-2 h-4 w-4" />
          Área restrita à gestão do CRM.
        </div>
      ) : (
        <div className="space-y-5">
          {notice && (
            <p className="rounded-xl border border-[color:var(--border)] p-3 text-sm text-[color:var(--muted-foreground)]">
              {notice}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Leads na etapa NOVOS", totals.total],
              ["Boas-vindas enviadas", totals.enviadas],
              ["Aguardando envio", totals.pendentes],
              ["Falhas de envio", totals.falhas],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-[color:var(--border)] p-3"
              >
                <p className="text-[11px] text-[color:var(--muted-foreground)]">{label}</p>
                <p className="font-display text-lg">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] px-3 py-2">
            <Search className="h-4 w-4 text-[color:var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="overflow-hidden rounded-2xl border border-[color:var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2">Lead</th>
                    <th className="px-3 py-2">Contato</th>
                    <th className="px-3 py-2">Recebido</th>
                    <th className="px-3 py-2">Boas-vindas</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-xs text-[color:var(--muted-foreground)]">
                        Carregando leads…
                      </td>
                    </tr>
                  )}
                  {!loading && leads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-xs text-[color:var(--muted-foreground)]">
                        Nenhum lead recebido até o momento.
                      </td>
                    </tr>
                  )}
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedId(lead.id)}
                      className={`cursor-pointer border-t border-[color:var(--border)] transition hover:bg-white/5 ${
                        selectedId === lead.id ? "bg-white/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{lead.name || "Sem nome"}</p>
                        <p className="text-[11px] text-[color:var(--muted-foreground)]">
                          {lead.origin ?? "—"} · {lead.captureForm ?? "Formulário não informado"}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <p>{lead.phone || "Sem telefone"}</p>
                        <p className="text-[color:var(--muted-foreground)]">{lead.email || "—"}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-[color:var(--muted-foreground)]">
                        {formatDate(lead.externalCreatedAt ?? lead.ingestedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={lead.welcomeStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border)] p-4">
                <h2 className="font-display text-sm">Ficha do lead</h2>
                {!selected ? (
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    Selecione um lead para ver os dados e o histórico.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3 text-xs">
                    <div>
                      <p className="font-display text-base">{selected.name || "Sem nome"}</p>
                      <p className="text-[color:var(--muted-foreground)]">
                        {selected.phone || "Sem telefone"} · {selected.email || "sem e-mail"}
                      </p>
                    </div>
                    <p className="text-[color:var(--muted-foreground)]">
                      Etapa: {selected.stageKey ?? "—"} · Funil: {selected.pipelineName ?? "—"}
                    </p>
                    <p className="text-[color:var(--muted-foreground)]">
                      Última sincronização: {formatDate(selected.lastSyncedAt)}
                      {selected.syncStatus !== "OK" && (
                        <span className="ml-1 text-red-400">
                          <AlertTriangle className="mb-0.5 inline h-3 w-3" /> {selected.syncError}
                        </span>
                      )}
                    </p>
                    <p className="text-[color:var(--muted-foreground)]">
                      Boas-vindas: {WELCOME_LABEL[selected.welcomeStatus] ?? selected.welcomeStatus}
                      {selected.welcomeSentAt ? ` · ${formatDate(selected.welcomeSentAt)}` : ""}
                    </p>
                    {selected.welcomeError && (
                      <p className="text-red-400">{selected.welcomeError}</p>
                    )}
                    {selected.welcomeStatus !== "SENT" && (
                      <button
                        type="button"
                        onClick={() => void handleRetry(selected.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--gold)]/50 px-3 py-1.5 text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/10"
                      >
                        <Send className="h-3.5 w-3.5" /> Enviar boas-vindas
                      </button>
                    )}
                    <div className="border-t border-[color:var(--border)] pt-3">
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
                        Histórico
                      </p>
                      <ul className="space-y-1">
                        {events.map((event) => (
                          <li key={event.id} className="text-[color:var(--muted-foreground)]">
                            <span className="text-[color:var(--foreground)]">{event.type}</span> ·{" "}
                            {formatDate(event.createdAt)}
                            {event.message ? ` — ${event.message}` : ""}
                          </li>
                        ))}
                        {events.length === 0 && <li>Sem eventos registrados.</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[color:var(--border)] p-4">
                <h2 className="flex items-center gap-2 font-display text-sm">
                  <Clock className="h-4 w-4" /> Execuções recentes
                </h2>
                <ul className="mt-3 space-y-2 text-[11px] text-[color:var(--muted-foreground)]">
                  {runs.map((run) => (
                    <li key={run.id} className="flex items-start gap-2">
                      {run.status === "OK" ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-red-400" />
                      )}
                      <span>
                        {formatDate(run.startedAt)} · {run.trigger} · {run.created} novos,{" "}
                        {run.updated} atualizados, {run.welcomeSent} boas-vindas
                        {run.message ? ` — ${run.message}` : ""}
                      </span>
                    </li>
                  ))}
                  {runs.length === 0 && <li>Nenhuma execução registrada.</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </ExecutiveShell>
  );
}
