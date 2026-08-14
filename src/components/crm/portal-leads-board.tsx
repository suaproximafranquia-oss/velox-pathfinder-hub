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
import { DatabaseBackup, Lock, Phone, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { DailyCallsOverlay } from "@/components/crm/daily-calls-overlay";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { isCrmAdministrator, isCrmSupervisor } from "@/lib/crm/permissions";
import {
  getCrmLead,
  listCrmLeads,
  listCrmSyncRuns,
  retryCrmWelcome,
  runCrmBackfillNow,
  runCrmSyncNow,
  type CrmLeadEventView,
  type CrmLeadView,
  type CrmSyncRunView,
} from "@/lib/crm/leads.functions";
import {
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
  NOT_APPLICABLE: "Sem primeiro contato",
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

/** Indicador discreto: apenas estado, nunca credenciais. */
function ConnectionDot({ state }: { state: CrmConnectionState | null }) {
  const connected = Boolean(state?.connected);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
      {connected ? "Green Sales conectado" : "Desconectado"}
    </span>
  );
}

function LeadCard({
  lead,
  onOpen,
  showWelcome,
}: {
  lead: CrmLeadView;
  onOpen: () => void;
  /** O primeiro contato só é informação operacional na etapa de entrada. */
  showWelcome: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] transition hover:border-[color:var(--gold)]/50 hover:bg-white/[0.07]"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--gold)]/15 text-[11px] font-medium text-[color:var(--gold)]">
          {(lead.name || "?").trim().charAt(0).toUpperCase()}
        </span>
        <p className="truncate text-[13px] font-medium text-white/90">{lead.name || "Sem nome"}</p>
      </div>
      <p className="mt-1.5 truncate text-[11px] text-white/50">
        {lead.phone || lead.email || "Sem contato"}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
        <span className="text-[10px] text-white/40">
          {formatDate(lead.externalCreatedAt ?? lead.ingestedAt)}
        </span>
        {showWelcome && lead.welcomeStatus !== "NOT_APPLICABLE" && (
          <StatusPill status={lead.welcomeStatus} />
        )}
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
          {lead.welcomeStatus !== "SENT" && lead.welcomeStatus !== "NOT_APPLICABLE" && (
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
  const [backfilling, setBackfilling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [callsOpen, setCallsOpen] = useState(false);

  const fetchLeads = useServerFn(listCrmLeads);
  const fetchRuns = useServerFn(listCrmSyncRuns);
  const fetchLead = useServerFn(getCrmLead);
  const fetchStages = useServerFn(listCrmStages);
  const fetchConnection = useServerFn(getGreenSalesConnection);
  const runSync = useServerFn(runCrmSyncNow);
  const runBackfill = useServerFn(runCrmBackfillNow);
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

  const lastSync = runs[0]?.startedAt ?? null;

  const byStage = useMemo(() => {
    const map = new Map<string, CrmLeadView[]>();
    for (const stage of stages) map.set(stage.key, []);
    for (const lead of leads) {
      // Espelho fiel: sem etapa na origem, o lead NÃO entra em nenhuma
      // coluna. Antes ele caía em NOVOS por fallback — a divergência.
      if (!lead.stageKey) continue;
      if (!map.has(lead.stageKey)) map.set(lead.stageKey, []);
      map.get(lead.stageKey)!.push(lead);
    }
    return map;
  }, [leads, stages]);

  /** Leads que existem na origem mas não estão em nenhuma etapa do funil. */
  const outsideFunnel = useMemo(() => leads.filter((l) => !l.stageKey).length, [leads]);

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

  /** Carga histórica: reconstrói o estado da origem, sem disparar mensagens. */
  async function handleBackfill() {
    if (
      !window.confirm(
        "Importar todo o histórico de leads da origem? Nenhum lead será duplicado e nenhuma mensagem de boas-vindas será enviada.",
      )
    )
      return;
    setBackfilling(true);
    setNotice(null);
    try {
      const s = await runBackfill({});
      setNotice(
        s.ok
          ? `Carga histórica concluída: ${s.found} encontrados (${s.pagesScanned} páginas), ${s.created} criados, ${s.updated} atualizados, ${s.unchanged} já existentes, ${s.failed} com erro, 0 mensagens enviadas.`
          : `Carga histórica com falha: ${s.message ?? "erro desconhecido"}.`,
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha na carga histórica.");
    } finally {
      setBackfilling(false);
    }
  }

  if (!session) return null;

  const content = (
    <div className="rounded-3xl border border-white/10 bg-[color:var(--navy-deep)] bg-[radial-gradient(1200px_500px_at_10%_-10%,color-mix(in_oklab,var(--gold)_9%,transparent),transparent_60%)] p-4 text-white/85 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] md:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[color:var(--gold)]">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-lg leading-tight text-white">Portal dos Leads</h1>
            <p className="text-[11px] text-white/45">CRM Velox · funil espelhado da origem</p>
          </div>
        </div>

        {allowed && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:max-w-sm">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
              />
            </div>
            <ConnectionDot state={connection} />
            {lastSync && (
              <span className="text-[10px] text-white/40">Atualizado {formatDate(lastSync)}</span>
            )}
            <button
              type="button"
              onClick={() => setCallsOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20"
            >
              <Phone className="h-4 w-4" />
              Ligações do Dia
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar agora"}
            </button>
            <button
              type="button"
              onClick={handleBackfill}
              disabled={backfilling}
              title="Reconstrói o estado completo da origem, sem duplicar leads e sem enviar mensagens."
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              <DatabaseBackup className={`h-4 w-4 ${backfilling ? "animate-pulse" : ""}`} />
              {backfilling ? "Importando histórico…" : "Carga histórica"}
            </button>
          </div>
        )}
      </header>

      {!allowed ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/60">
          <ShieldCheck className="mb-2 h-4 w-4" />
          Área restrita à gestão do CRM.
        </div>
      ) : (
        <div className="space-y-4">
          {notice && (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">
              {notice}
            </p>
          )}

          <p className="flex items-center gap-2 text-[11px] text-white/35">
            <Lock className="h-3 w-3" /> Quadro somente leitura — a movimentação acontece na origem.
            {outsideFunnel > 0 && (
              <span className="text-white/30">
                · {outsideFunnel} lead(s) sem etapa no funil da origem
              </span>
            )}
          </p>

          {loading ? (
            <p className="text-xs text-white/50">Carregando quadro…</p>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {stages.map((stage) => {
                const items = byStage.get(stage.key) ?? [];
                return (
                  <section
                    key={stage.key}
                    className="flex w-[248px] shrink-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
                      <h2 className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">
                        {stage.label}
                      </h2>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                        {items.length}
                      </span>
                    </header>
                    <div className="flex max-h-[64vh] flex-col gap-2 overflow-y-auto p-2">
                      {items.length === 0 && (
                        <p className="px-1 py-6 text-center text-[11px] text-white/30">Sem leads</p>
                      )}
                      {items.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          showWelcome={stage.isEntry}
                          onOpen={() => setSelectedId(lead.id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
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

      <DailyCallsOverlay
        open={callsOpen}
        onClose={() => {
          setCallsOpen(false);
          void load();
        }}
        onOpenLead={(leadId) => {
          setCallsOpen(false);
          setSelectedId(leadId);
        }}
      />
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-[color:var(--navy-deep)] px-3 py-4 md:px-6 md:py-6">
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
