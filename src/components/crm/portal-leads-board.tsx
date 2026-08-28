/**
 * Green Sales — CRM visual do Portal Velox (quadro Kanban).
 *
 * A origem externa continua sendo a fonte da verdade: o quadro apenas
 * espelha as etapas. A única escrita é a MOVIMENTAÇÃO MANUAL DE
 * CONTINGÊNCIA (regras 9 e 10 do plano aprovado): ajuste local,
 * auditado, que não altera a origem, não cria cadência e não dispara
 * primeiro contato — a próxima sincronização corrige o espelho se a
 * origem divergir. A conexão com a origem pertence ao Executivo
 * autenticado.
 */
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, DatabaseBackup, Lock, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { DailyActionsOverlay } from "@/components/crm/daily-actions-overlay";
import { getDailyActionsSummary } from "@/lib/crm/daily-actions.functions";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { isCrmAdministrator, isCrmSupervisor } from "@/lib/crm/permissions";
import {
  getCrmLead,
  listCrmLeads,
  listCrmSyncRuns,
  moveCrmLeadStage,
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
  stages,
  onClose,
  onRetry,
  onMove,
}: {
  lead: CrmLeadView;
  events: CrmLeadEventView[];
  stages: CrmStageView[];
  onClose: () => void;
  onRetry: (id: string) => Promise<void>;
  onMove: (lead: CrmLeadView, stage: CrmStageView) => Promise<void>;
}) {
  const [moveTarget, setMoveTarget] = useState("");
  const [moving, setMoving] = useState(false);
  const moveOptions = stages.filter((s) => s.key !== lead.stageKey);

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

        {/**
         * E0 é ÚNICA: não existe reenvio de boas-vindas. Se a entrega
         * externa falhou, o estado fica visível e a retomada acontece
         * pela jornada — nunca por um segundo primeiro contato.
         */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusPill status={lead.welcomeStatus} />
          {lead.welcomeError && <span className="text-xs text-red-400">{lead.welcomeError}</span>}
        </div>


        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3">
          <p className="text-[11px] font-medium text-amber-300">Mover para (contingência local)</p>
          <p className="mt-1 text-[10px] leading-relaxed text-white/50">
            Ajuste somente do espelho do Portal: não altera a origem, não cria cadência e não
            dispara primeiro contato. Se a origem divergir, a próxima sincronização corrige o
            espelho automaticamente.
          </p>
          <div className="mt-2 flex items-center gap-2">
            {/*
              §7 — o `select` nativo herdava o fundo branco do sistema
              operacional e as opções ficavam ilegíveis. As cores das
              OPTIONS precisam ser declaradas explicitamente: o Tailwind
              da caixa não alcança a lista renderizada pelo navegador.
            */}
            <select
              value={moveTarget}
              disabled={moving}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="h-8 flex-1 rounded-lg border border-white/15 bg-[color:var(--navy-deep,#0b1220)] px-2 text-xs text-white/90 outline-none transition focus:border-amber-400/60 disabled:opacity-50 [&>option:checked]:bg-amber-500/20"
              style={{ colorScheme: "dark" }}
            >
              <option value="" style={{ backgroundColor: "#0b1220", color: "#e5e7eb" }}>
                Selecionar etapa…
              </option>
              {moveOptions.map((stage) => (
                <option
                  key={stage.key}
                  value={stage.key}
                  style={{ backgroundColor: "#0b1220", color: "#e5e7eb" }}
                >
                  {stage.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!moveTarget || moving}
              onClick={() => {
                /*
                 * §8 — clique idempotente: enquanto a movimentação está
                 * em curso o controle fica bloqueado e exibe o estado de
                 * processamento. Só volta a ficar disponível depois que
                 * o servidor confirma o resultado.
                 */
                if (moving) return;
                const stage = moveOptions.find((s) => s.key === moveTarget);
                if (!stage) return;
                if (
                  !window.confirm(
                    `Mover "${lead.name || "este lead"}" localmente para "${stage.label}"? A origem não será alterada e nenhuma mensagem será enviada.`,
                  )
                )
                  return;
                setMoving(true);
                void onMove(lead, stage)
                  .then(() => setMoveTarget(""))
                  .finally(() => setMoving(false));
              }}
              className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-40"
            >
              {moving ? "Movendo…" : "Mover"}
            </button>
          </div>

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
  const [callsSummary, setCallsSummary] = useState<{ overdue: number; today: number } | null>(null);

  const fetchLeads = useServerFn(listCrmLeads);
  const fetchRuns = useServerFn(listCrmSyncRuns);
  const fetchLead = useServerFn(getCrmLead);
  const fetchStages = useServerFn(listCrmStages);
  const fetchConnection = useServerFn(getGreenSalesConnection);
  const runSync = useServerFn(runCrmSyncNow);
  const runBackfill = useServerFn(runCrmBackfillNow);
  const retryWelcome = useServerFn(retryCrmWelcome);
  const moveLead = useServerFn(moveCrmLeadStage);
  const fetchCallsSummary = useServerFn(getDailyActionsSummary);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/f/executivo" });
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
      try {
        setCallsSummary(await fetchCallsSummary({ data: { channel: "call" } }));
      } catch {
        setCallsSummary(null);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao carregar o quadro.");
    } finally {
      setLoading(false);
    }
  }, [fetchCallsSummary, fetchConnection, fetchLeads, fetchRuns, fetchStages, search]);

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

  /**
   * Espelho do agendador: o quadro não sincroniza, apenas percebe quando o
   * servidor concluiu uma sincronização automática e relê o banco.
   */
  const lastRunId = runs[0]?.id ?? null;
  useEffect(() => {
    if (!allowed) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchRuns({})
        .then((history) => {
          const latest = history[0]?.id ?? null;
          if (latest && latest !== lastRunId) void load();
        })
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [allowed, fetchRuns, lastRunId, load]);

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
          ? `Sincronização concluída: ${summary.created} novos (destes, ${summary.recovered} recuperações históricas sem primeiro contato), ${summary.updated} atualizados, ${summary.duplicatesAvoided} duplicidades evitadas, ${summary.welcomeSent} boas-vindas enviadas.`
          : `Sincronização com falha: ${summary.message ?? "erro desconhecido"}.`,
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha na sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  /**
   * Movimentação manual de contingência: ajuste LOCAL do espelho,
   * auditado, sem tocar a origem e sem disparar cadência ou E0.
   */
  async function handleMove(lead: CrmLeadView, stage: CrmStageView) {
    setNotice(null);
    const res = await moveLead({ data: { id: lead.id, stageKey: stage.key, stageLabel: stage.label } });
    setNotice(res.message);
    await load();
    if (selectedId) {
      void fetchLead({ data: { id: selectedId } }).then((r) => setEvents(r.events));
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

  const stageList = (
    <div
      className={
        standalone
          ? "-mx-1 flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-1"
          : "-mx-1 flex gap-3 overflow-x-auto px-1 pb-2"
      }
    >
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
            <div
              className={
                standalone
                  ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2"
                  : "flex max-h-[64vh] flex-col gap-2 overflow-y-auto p-2"
              }
            >
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
  );

  const board = (
    <>
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
              <CalendarClock className="h-4 w-4" />
              Ações do Dia
              {callsSummary && callsSummary.overdue + callsSummary.today > 0 && (
                <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px]">
                  {callsSummary.overdue > 0
                    ? `${callsSummary.overdue} atrasadas · ${callsSummary.today} hoje`
                    : callsSummary.today}
                </span>
              )}
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
        <div className={standalone ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
          {notice && (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">
              {notice}
            </p>
          )}

          <p className="flex items-center gap-2 text-[11px] text-white/35">
            <Lock className="h-3 w-3" /> Espelho da origem — a exceção é a contingência local
            auditada, corrigida pela próxima sincronização se a origem divergir.
            {outsideFunnel > 0 && (
              <span className="text-white/30">
                · {outsideFunnel} lead(s) sem etapa no funil da origem
              </span>
            )}
          </p>

          {loading ? (
            <p className="text-xs text-white/50">Carregando quadro…</p>
          ) : (
            stageList
          )}
        </div>
      )}

      {selected && (
        <LeadDialog
          lead={selected}
          events={events}
          stages={stages}
          onClose={() => setSelectedId(null)}
          onRetry={handleRetry}
          onMove={handleMove}
        />
      )}

      <DailyActionsOverlay
        open={callsOpen}
        onClose={() => {
          setCallsOpen(false);
          void load();
        }}
        /**
         * A ficha completa tem endereço próprio e abre em nova aba: o
         * Executivo consulta o investidor sem perder a fila do dia.
         */
        onOpenLead={(leadId) => {
          window.open(`/f/executivo/investidores/${leadId}`, "_blank", "noopener");
        }}
      />
    </>
  );

  if (!session) return null;

  if (standalone) {
    return (
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[color:var(--navy-deep)] px-4 py-4 md:px-6 md:py-5">
        {board}
      </div>
    );
  }

  return (
    <ExecutiveShell session={session} title="Portal dos Leads">
      <div className="rounded-3xl border border-white/10 bg-[color:var(--navy-deep)] bg-[radial-gradient(1200px_500px_at_10%_-10%,color-mix(in_oklab,var(--gold)_9%,transparent),transparent_60%)] p-4 text-white/85 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] md:p-6">
        {board}
      </div>
    </ExecutiveShell>
  );
}
