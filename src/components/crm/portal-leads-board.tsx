/**
 * Green Sales — CRM visual do Portal Velox (quadro Kanban, somente leitura).
 *
 * A origem externa continua sendo a fonte da verdade: o quadro apenas
 * espelha as etapas. Nenhum lead pode ser movido manualmente aqui.
 * A conexão com a origem pertence ao Executivo autenticado.
 */
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Lock, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
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
import {
  connectGreenSales,
  disconnectGreenSales,
  getGreenSalesConnection,
  listCrmStages,
  type CrmConnectionState,
  type CrmStageView,
} from "@/lib/crm/connection.functions";

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
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${tone}`}>
      {WELCOME_LABEL[status] ?? status}
    </span>
  );
}

function ConnectionBar({
  state,
  onConnect,
  onDisconnect,
  busy,
}: {
  state: CrmConnectionState | null;
  onConnect: (email: string, password: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="rounded-2xl border border-[color:var(--border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border)]">
            <Link2 className="h-4 w-4 text-[color:var(--gold)]" />
          </span>
          <div>
            <p className="text-sm">
              {state?.connected ? (
                <>
                  Conectado como <strong>{state.owner}</strong>
                  {state.accountEmail ? ` · ${state.accountEmail}` : ""}
                </>
              ) : (
                "Nenhuma conta Green Sales conectada a este usuário."
              )}
            </p>
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              A conexão é pessoal: cada Executivo utiliza a própria conta de origem.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl border border-[color:var(--border)] px-3 py-1.5 text-xs"
          >
            {state?.connected ? "Reconectar" : "Conectar conta"}
          </button>
          {state?.connected && (
            <button
              type="button"
              onClick={() => void onDisconnect()}
              disabled={busy}
              className="rounded-xl border border-red-500/40 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
            >
              Desconectar
            </button>
          )}
        </div>
      </div>

      {open && (
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            await onConnect(email, password);
            setPassword("");
            setOpen(false);
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail da conta Green Sales"
            className="rounded-xl border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="rounded-xl border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl border border-[color:var(--gold)]/50 px-4 py-2 text-sm text-[color:var(--gold)] disabled:opacity-50"
          >
            {busy ? "Validando…" : "Salvar"}
          </button>
        </form>
      )}
    </div>
  );
}

function LeadCard({ lead, onOpen }: { lead: CrmLeadView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-3 text-left transition hover:border-[color:var(--gold)]/40"
    >
      <p className="truncate text-sm">{lead.name || "Sem nome"}</p>
      <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted-foreground)]">
        {lead.phone || lead.email || "Sem contato"}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[color:var(--muted-foreground)]">
          {formatDate(lead.externalCreatedAt ?? lead.ingestedAt)}
        </span>
        <StatusPill status={lead.welcomeStatus} />
      </div>
    </button>
  );
}

function LeadDialog({
  lead,
  events,
  onClose,
  onRetry,
}: {
  lead: CrmLeadView;
  events: CrmLeadEventView[];
  onClose: () => void;
  onRetry: (id: string) => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg">{lead.name || "Sem nome"}</h2>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              {lead.pipelineName ?? "Funil"} · etapa {lead.stageKey ?? "—"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["WhatsApp", lead.phone || "—"],
            ["E-mail", lead.email || "—"],
            ["Origem", lead.origin ?? "—"],
            ["Formulário", lead.captureForm ?? "—"],
            ["Criado na origem", formatDate(lead.externalCreatedAt)],
            ["Recebido no Portal", formatDate(lead.ingestedAt)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[color:var(--border)] p-3">
              <dt className="text-[11px] text-[color:var(--muted-foreground)]">{label}</dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusPill status={lead.welcomeStatus} />
          {lead.welcomeStatus !== "SENT" && (
            <button
              type="button"
              onClick={() => void onRetry(lead.id)}
              className="rounded-xl border border-[color:var(--gold)]/50 px-3 py-1.5 text-xs text-[color:var(--gold)]"
            >
              Reenviar boas-vindas
            </button>
          )}
          {lead.welcomeError && <span className="text-xs text-red-400">{lead.welcomeError}</span>}
        </div>

        <h3 className="mt-6 mb-2 text-xs uppercase tracking-wide text-[color:var(--muted-foreground)]">
          Histórico
        </h3>
        <ul className="space-y-2">
          {events.length === 0 && (
            <li className="text-xs text-[color:var(--muted-foreground)]">Sem eventos.</li>
          )}
          {events.map((e) => (
            <li key={e.id} className="rounded-xl border border-[color:var(--border)] p-3 text-xs">
              <p>{e.message ?? e.type}</p>
              <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">
                {formatDate(e.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PortalLeadsBoard({ standalone = false }: { standalone?: boolean }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [stages, setStages] = useState<CrmStageView[]>([]);
  const [leads, setLeads] = useState<CrmLeadView[]>([]);
  const [runs, setRuns] = useState<CrmSyncRunView[]>([]);
  const [connection, setConnection] = useState<CrmConnectionState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<CrmLeadEventView[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchLeads = useServerFn(listCrmLeads);
  const fetchRuns = useServerFn(listCrmSyncRuns);
  const fetchLead = useServerFn(getCrmLead);
  const fetchStages = useServerFn(listCrmStages);
  const fetchConnection = useServerFn(getGreenSalesConnection);
  const saveConnection = useServerFn(connectGreenSales);
  const dropConnection = useServerFn(disconnectGreenSales);
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
      const [rows, history, stageList, conn] = await Promise.all([
        fetchLeads({ data: { search } }),
        fetchRuns({}),
        fetchStages({}),
        fetchConnection({}),
      ]);
      setLeads(rows);
      setRuns(history);
      setStages(stageList);
      setConnection(conn);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao carregar o quadro.");
    } finally {
      setLoading(false);
    }
  }, [fetchConnection, fetchLeads, fetchRuns, fetchStages, search]);

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

  const byStage = useMemo(() => {
    const map = new Map<string, CrmLeadView[]>();
    for (const stage of stages) map.set(stage.key, []);
    for (const lead of leads) {
      const key = lead.stageKey ?? "novos";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lead);
    }
    return map;
  }, [leads, stages]);

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

  async function handleConnect(email: string, password: string) {
    setBusy(true);
    setNotice(null);
    try {
      setConnection(await saveConnection({ data: { email, password } }));
      setNotice("Conta Green Sales conectada a este usuário.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível conectar a conta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      setConnection(await dropConnection({}));
      setNotice("Conexão encerrada.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  const content = (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-xl">Portal dos Leads</h1>
            <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
              Quadro visual do funil. As etapas refletem exatamente a origem — a movimentação de
              leads acontece lá, aqui é leitura e operação de contato.
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
          <ConnectionBar
            state={connection}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            busy={busy}
          />

          {notice && (
            <p className="rounded-xl border border-[color:var(--border)] p-3 text-sm text-[color:var(--muted-foreground)]">
              {notice}
            </p>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] px-3 py-2">
            <Search className="h-4 w-4 text-[color:var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <p className="flex items-center gap-2 text-[11px] text-[color:var(--muted-foreground)]">
            <Lock className="h-3 w-3" /> Quadro somente leitura: os leads não podem ser arrastados
            entre etapas.
          </p>

          {loading ? (
            <p className="text-xs text-[color:var(--muted-foreground)]">Carregando quadro…</p>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {stages.map((stage) => {
                const items = byStage.get(stage.key) ?? [];
                return (
                  <section
                    key={stage.key}
                    className="flex w-[240px] shrink-0 flex-col rounded-2xl border border-[color:var(--border)]"
                  >
                    <header className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] px-3 py-2">
                      <h2 className="truncate text-[11px] uppercase tracking-wide">
                        {stage.label}
                      </h2>
                      <span className="rounded-full border border-[color:var(--border)] px-2 text-[10px]">
                        {items.length}
                      </span>
                    </header>
                    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
                      {items.length === 0 && (
                        <p className="px-1 py-4 text-center text-[11px] text-[color:var(--muted-foreground)]">
                          Sem leads
                        </p>
                      )}
                      {items.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          onOpen={() => setSelectedId(lead.id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-[color:var(--border)] p-4">
            <h2 className="mb-3 text-xs uppercase tracking-wide text-[color:var(--muted-foreground)]">
              Últimas sincronizações
            </h2>
            <ul className="space-y-2 text-xs">
              {runs.length === 0 && (
                <li className="text-[color:var(--muted-foreground)]">Nenhuma execução registrada.</li>
              )}
              {runs.map((run) => (
                <li key={run.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-[color:var(--muted-foreground)]">
                    {formatDate(run.startedAt)}
                  </span>
                  <span>{run.status}</span>
                  <span className="text-[color:var(--muted-foreground)]">
                    {run.found} encontrados · {run.created} novos · {run.updated} atualizados ·{" "}
                    {run.welcomeSent} boas-vindas
                  </span>
                  {run.message && <span className="text-red-400">{run.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {selected && (
        <LeadDialog
          lead={selected}
          events={events}
          onClose={() => setSelectedId(null)}
          onRetry={handleRetry}
        />
      )}
    </>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] px-4 py-6 text-[color:var(--foreground)] md:px-8">
        {content}
      </div>
    );
  }

  return (
    <ExecutiveShell session={session} title="Portal dos Leads">
      {content}
    </ExecutiveShell>
  );
}
