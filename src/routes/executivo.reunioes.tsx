import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Plus,
  MessageSquare,
  X,
  Eye,
  Pencil,
  RefreshCw,
  Search,
  Video,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  History,
  ListChecks,
  LayoutGrid,
  Cloud,
  CloudOff,
  Link2,
  Send,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { TIME_INPUT_PROPS, isValidTimeValue, sanitizeTimeValue } from "@/lib/time-input";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ScopeSelector } from "@/components/executive/scope-selector";
import { defaultScope, type ScopeSelection } from "@/lib/brain/scopes";
import {
  getSession,
  canViewAllInvestors,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import {
  addMeetingNote,
  createMeeting,
  listMeetings,
  updateMeetingStatus,
  updateMeeting,
  type Meeting,
  type MeetingStatus,
  type GoogleSyncState,
} from "@/lib/meetings";
import { loadLeads } from "@/lib/leads";
import { confirmRequest, declineRequest } from "@/lib/scheduling-flow";
import { InvestorProfilePanel } from "@/components/executive/investor-profile-panel";
import { logAudit } from "@/lib/audit-log";
import { listEvents, onEvent, type PortalEvent } from "@/lib/events/bus";
import {
  trySyncCreate,
  trySyncUpdate,
  syncPending,
  checkConflicts,
  DEFAULT_TIMEZONE,
} from "@/lib/google-calendar";
import { getGoogleStore, subscribeGoogleStore } from "@/lib/google-workspace";
import { onSync } from "@/lib/sync-bus";
import {
  MEETING_PROVIDERS,
  getDefaultProviderForExecutive,
  getProvider,
  resolveMeetingProvider,
  resolveMeetingUrl,
  tryGenerateProviderLink,
  type MeetingProviderId,
  type MeetingProviderStatus,
} from "@/lib/meeting-providers";

export const Route = createFileRoute("/executivo/reunioes")({
  head: () => ({
    meta: [
      { title: "Central de Reuniões — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeetingsPage,
});

const STATUS_FLOW: MeetingStatus[] = [
  "Solicitada",
  "Agendada",
  "Confirmada",
  "Reagendada",
  "Em andamento",
  "Concluída",
  "Cancelada",
];

const STATUS_STYLES: Record<MeetingStatus, { bg: string; fg: string; border: string; label: string }> = {
  Solicitada: { bg: "rgba(176,141,87,0.18)", fg: "#B08D57", border: "#B08D57", label: "Solicitada" },
  Agendada: { bg: "rgba(59,126,161,0.15)", fg: "#3B7EA1", border: "#3B7EA1", label: "Agendada" },
  Confirmada: { bg: "rgba(74,124,89,0.15)", fg: "#4A7C59", border: "#4A7C59", label: "Confirmada" },
  Reagendada: { bg: "rgba(214,180,72,0.18)", fg: "#B08D57", border: "#B08D57", label: "Reagendada" },
  "Em andamento": { bg: "rgba(128,90,213,0.18)", fg: "#805AD5", border: "#805AD5", label: "Em andamento" },
  Concluída: { bg: "rgba(45,55,72,0.25)", fg: "#4A5568", border: "#4A5568", label: "Concluída" },
  Cancelada: { bg: "rgba(197,48,48,0.15)", fg: "#C53030", border: "#C53030", label: "Cancelada" },
};

type SortKey = "recent" | "oldest" | "upcoming" | "past";
type StatusFilter = "all" | MeetingStatus;
type TabKey = "lista" | "calendario" | "agenda" | "historico";

function isOverdue(m: Meeting): boolean {
  if (m.status !== "Agendada" && m.status !== "Confirmada") return false;
  return new Date(m.scheduledAt).getTime() < Date.now();
}

const GOOGLE_SYNC_STYLES: Record<GoogleSyncState, { label: string; fg: string; bg: string; border: string; Icon: typeof Cloud }> = {
  synced:  { label: "Google sincronizado", fg: "#2C7A4B", bg: "rgba(44,122,75,0.14)",  border: "#2C7A4B", Icon: CheckCircle2 },
  pending: { label: "Google pendente",     fg: "#B08D57", bg: "rgba(176,141,87,0.16)", border: "#B08D57", Icon: Cloud },
  failed:  { label: "Erro de sincronização", fg: "#C53030", bg: "rgba(197,48,48,0.14)",border: "#C53030", Icon: XCircle },
  none:    { label: "Sem integração",      fg: "#4A5568", bg: "rgba(74,85,104,0.14)",  border: "#4A5568", Icon: CloudOff },
};


function ymd(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function MeetingsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [scope, setScope] = useState<ScopeSelection | null>(null);
  const [items, setItems] = useState<Meeting[]>([]);
  const [detailsFor, setDetailsFor] = useState<Meeting | null>(null);
  const [profileOpen, setProfileOpen] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("lista");
  const [agendaDate, setAgendaDate] = useState<string>(() => ymd(new Date()));
  const [calMonth, setCalMonth] = useState<Date>(() => { const d = new Date(); d.setDate(1); return d; });
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  /** Reenvia o convite do Google (evento existente = novo e-mail para todos). */
  async function resendInvite(m: Meeting) {
    if (!session) return;
    setInviteBusy(m.id);
    setInviteFeedback(null);
    const actor = {
      userId: session.userId,
      userName: session.name,
      userRole: "Executivo",
      email: session.email,
    };
    const result = m.googleEventId
      ? await trySyncUpdate(m, actor)
      : await trySyncCreate(m, actor);
    setInviteBusy(null);
    refresh();
    setInviteFeedback(
      result.googleSync === "synced"
        ? `Convite reenviado para os participantes de ${m.investorName}.`
        : "Conecte sua conta Google em Configurações para enviar convites automaticamente.",
    );
  }

  async function copyMeetingLink(m: Meeting) {
    const url = resolveMeetingUrl(m);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setInviteFeedback("Link da reunião copiado.");
    } catch {
      setInviteFeedback("Não foi possível copiar o link.");
    }
  }
  const [googleTick, setGoogleTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    const off = subscribeGoogleStore(session.userId, () => setGoogleTick((t) => t + 1));
    return () => off();
  }, [session?.userId]);

  const googleStore = session ? getGoogleStore(session.userId) : null;
  void googleTick;
  const googleConnected = googleStore?.state === "connected";

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else {
      setSession(s);
      setScope(defaultScope(s.activeRole, s.userId));
    }
  }, [navigate]);

  // Central de Reuniões corporativa: Gestora e Administrador enxergam
  // automaticamente todas as reuniões criadas pelos Colaboradores. O escopo
  // (ITEM 03) permite alternar entre a equipe e um Executivo específico.
  const refresh = () =>
    setItems(
      listMeetings(
        session && !canViewAllInvestors(session.role)
          ? { executiveId: session.userId }
          : scope?.mode === "executive" && scope.executiveId
          ? { executiveId: scope.executiveId }
          : undefined,
      ),
    );

  useEffect(() => {
    if (session) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, scope]);

  // Auto-refresh: assina eventos de reunião no bus e re-renderiza a cada minuto
  // para atualizar o indicador de "Horário ultrapassado".
  useEffect(() => {
    const off = onEvent((ev) => {
      if (ev.type.startsWith("meeting.")) refresh();
    });
    // Toda reunião criada/alterada aparece imediatamente para Executivo,
    // Gestora e Administrador, sem recarregar a tela.
    const offSync = onSync(() => refresh(), ["meetings"]);
    const t = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => { off(); offSync(); window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, scope]);

  // Painel superior — recomputa quando items mudam.
  const today = ymd(new Date());
  const todayItems = useMemo(
    () => items.filter((m) => ymd(new Date(m.scheduledAt)) === today),
    [items, today, tick],
  );
  const todayDone = todayItems.filter((m) => m.status === "Concluída").length;
  const todayRemaining = todayItems.length - todayDone;
  const nextMeeting = useMemo(() => {
    const now = Date.now();
    return [...items]
      .filter((m) => new Date(m.scheduledAt).getTime() >= now && m.status !== "Cancelada" && m.status !== "Concluída")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0] ?? null;
  }, [items, tick]);
  const pendings = useMemo(() => {
    const noNotes = items.filter((m) => m.notes.length === 0 && m.status === "Concluída");
    const rescheduled = items.filter((m) => m.status === "Reagendada");
    const noLink = items.filter((m) => m.status === "Confirmada" && !m.meetUrl);
    return { noNotes, rescheduled, noLink };
  }, [items]);
  const stats = useMemo(() => {
    const s: Record<MeetingStatus, number> = {
      Solicitada: 0, Agendada: 0, Confirmada: 0, Reagendada: 0, "Em andamento": 0, Concluída: 0, Cancelada: 0,
    };
    for (const m of items) s[m.status]++;
    return s;
  }, [items]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = query.trim().toLowerCase();
    let list = items.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (q) {
        const hay = [
          m.investorName,
          m.executiveName,
          ...m.notes.map((n) => n.text),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const ta = new Date(a.scheduledAt).getTime();
      const tb = new Date(b.scheduledAt).getTime();
      if (sort === "recent") return (b.createdAt < a.createdAt ? -1 : 1);
      if (sort === "oldest") return (a.createdAt < b.createdAt ? -1 : 1);
      if (sort === "upcoming") {
        const fa = ta >= now ? ta - now : Infinity;
        const fb = tb >= now ? tb - now : Infinity;
        return fa - fb;
      }
      // past
      const pa = ta <= now ? now - ta : Infinity;
      const pb = tb <= now ? now - tb : Infinity;
      return pa - pb;
    });
    return list;
  }, [items, statusFilter, sort, query]);

  const hasActiveFilters = statusFilter !== "all" || query.trim().length > 0;

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Reuniões">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-5 sm:flex sm:flex-wrap sm:justify-between">
        <p className="text-sm text-[color:var(--muted-foreground)] max-w-2xl min-w-0">
          Histórico consolidado das reuniões da sua carteira. As reuniões são
          criadas a partir do Lead no Workspace e operadas no CRM — esta Central
          apenas consulta, pesquisa, filtra, audita e registra. Nenhuma reunião
          é excluída.
        </p>
        {scope && canViewAllInvestors(session.role) && (
          <ScopeSelector session={session} scope={scope} onChange={setScope} />
        )}
      </div>

      <SummaryPanel
        todayCount={todayItems.length}
        todayDone={todayDone}
        todayRemaining={todayRemaining}
        nextMeeting={nextMeeting}
        onOpenNext={() => nextMeeting && setDetailsFor(nextMeeting)}
        stats={stats}
        onOpen={(m) => setDetailsFor(m)}
      />

      <PendingRequestsPanel
        requests={items.filter((m) => m.status === "Solicitada")}
        session={session}
        onChanged={refresh}
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-[color:var(--border)]">
        {([
          ["lista", "Lista", ListChecks],
          ["calendario", "Calendário", LayoutGrid],
          ["agenda", "Agenda", Clock],
          ["historico", "Histórico", History],
        ] as [TabKey, string, typeof ListChecks][]).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === key
                ? "border-[color:var(--gold)] text-[color:var(--foreground)]"
                : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "lista" && (
      <>
      <div className="mb-4 grid gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="relative block min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por investidor, executivo ou observação..."
            className="w-full rounded-md border border-[color:var(--border)] bg-transparent pl-9 pr-3 py-2 text-sm"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="all">Todos os status</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="recent">Mais recente</option>
          <option value="oldest">Mais antiga</option>
          <option value="upcoming">Próximas reuniões</option>
          <option value="past">Últimas reuniões</option>
        </select>
      </div>

      {inviteFeedback && (
        <p className="mb-3 text-xs text-[color:var(--muted-foreground)]">{inviteFeedback}</p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-10 text-center text-sm text-[color:var(--muted-foreground)]">
          Nenhuma reunião registrada. As reuniões nascem no card do investidor,
          dentro do Workspace.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-10 text-center">
          <Calendar className="mx-auto h-8 w-8 text-[color:var(--muted-foreground)]" />
          <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
            Nenhuma reunião encontrada para os filtros selecionados.
          </p>
          <button
            type="button"
            onClick={() => { setStatusFilter("all"); setQuery(""); }}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 px-4 py-2 text-xs text-[color:var(--foreground)] hover:bg-[color:var(--accent)]"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((m) => {
            const st = STATUS_STYLES[m.status];
            const when = new Date(m.scheduledAt);
            const overdue = isOverdue(m);
            return (
              <li
                key={m.id}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4 md:p-5"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_auto_minmax(0,auto)] lg:items-center">
                  {/* Coluna 1 — Investidor */}
                  <div className="min-w-0">
                     <div className="flex items-center gap-2 mb-1">
                       <Calendar className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
                       <button
                         type="button"
                         onClick={() => setProfileOpen(m.investorId)}
                         className="truncate font-display text-base text-left hover:text-[color:var(--gold)]"
                       >
                         {m.investorName}
                       </button>
                     </div>
                     <div className="mt-1">
                       {resolveMeetingUrl(m) ? (
                         <a
                           href={resolveMeetingUrl(m)}
                           target="_blank"
                           rel="noreferrer"
                           className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)]/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]"
                         >
                           <Video className="h-3 w-3 text-[color:var(--gold)]" /> Entrar na reunião
                         </a>
                       ) : resolveMeetingProvider(m).id === "google_meet" ? (
                         <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                           Aguardando configuração da integração Google Meet.
                         </span>
                       ) : (
                         <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                           Sem link
                         </span>
                       )}
                     </div>
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {when.toLocaleDateString("pt-BR")} · {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {m.cancelReason && (
                      <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">Motivo: {m.cancelReason}</p>
                    )}
                  </div>

                  {/* Coluna 2 — Status */}
                  <div className="flex flex-wrap gap-1.5 lg:justify-center">
                    <span
                      className="text-[10px] uppercase tracking-[0.22em] rounded-full px-3 py-1"
                      style={{ color: st.fg, background: st.bg, border: `1px solid ${st.border}` }}
                    >
                      {st.label}
                    </span>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] rounded-full px-2 py-1"
                        style={{ color: "#C53030", background: "rgba(197,48,48,0.15)", border: "1px solid #C53030" }}>
                        <AlertTriangle className="h-3 w-3" /> Horário ultrapassado
                      </span>
                    )}
                  </div>

                  {/* Coluna 3 — Ações */}
                  <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                    <ActionButton icon={Eye} label="Ver detalhes" onClick={() => setDetailsFor(m)} />
                    {resolveMeetingUrl(m) && (
                      <ActionButton icon={Link2} label="Copiar link" onClick={() => void copyMeetingLink(m)} />
                    )}
                    <ActionButton
                      icon={Send}
                      label={inviteBusy === m.id ? "Enviando..." : "Reenviar convite"}
                      onClick={() => void resendInvite(m)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </>
      )}

      {tab === "calendario" && (
        <CalendarView
          month={calMonth}
          items={items}
          onPrev={() => setCalMonth((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
          onNext={() => setCalMonth((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
          onOpen={(m) => setDetailsFor(m)}
        />
      )}

      {tab === "agenda" && (
        <AgendaView
          date={agendaDate}
          onDateChange={setAgendaDate}
          items={items}
          onOpen={(m) => setDetailsFor(m)}
        />
      )}

      {tab === "historico" && (
        <HistoryView executiveId={session.userId} items={items} />
      )}


      {detailsFor && (
        <DetailsDialog meeting={detailsFor} onClose={() => setDetailsFor(null)} />
      )}



      <InvestorProfilePanel
        investorId={profileOpen}
        open={!!profileOpen}
        onClose={() => setProfileOpen(null)}
      />
    </ExecutiveShell>
  );
}

/**
 * Solicitações do Portal aguardando confirmação do executivo responsável.
 * Ao confirmar, o evento do Google Calendar e o Meet são criados automaticamente.
 */
function PendingRequestsPanel({
  requests,
  session,
  onChanged,
}: {
  requests: Meeting[];
  session: ExecutiveSession;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  async function confirm(meeting: Meeting, iso: string) {
    setBusy(meeting.id);
    setError(null);
    setFeedback(null);
    const outcome = await confirmRequest(meeting.id, iso, {
      userId: session.userId,
      userName: session.name,
      email: session.email,
    });
    setBusy(null);
    if (!outcome.ok) {
      setError(outcome.message);
      onChanged();
      return;
    }
    setFeedback(
      outcome.googleNotice ??
        `Reunião confirmada e convite criado${outcome.meeting.meetUrl ? " com link do Meet" : ""}.`,
    );
    onChanged();
  }

  async function decline(meeting: Meeting) {
    setBusy(meeting.id);
    await declineRequest(
      meeting,
      { userId: session.userId, userName: session.name, email: session.email },
      "Solicitação recusada pelo executivo",
    );
    setBusy(null);
    setFeedback("Solicitação recusada. O investidor pode escolher novos horários.");
    onChanged();
  }

  return (
    <section
      className="mb-6 rounded-xl border p-5"
      style={{ borderColor: "var(--gold)", background: "color-mix(in oklab, var(--gold) 6%, transparent)" }}
    >
      <h2 className="text-sm font-medium">
        Solicitações de reunião ({requests.length})
      </h2>
      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
        Investidores escolheram horários preferenciais. Confirme um deles para gerar o convite e o
        link da reunião.
      </p>
      <ul className="mt-4 space-y-3">
        {requests.map((m) => {
          const options = m.requestedSlots?.length ? m.requestedSlots : [m.scheduledAt];
          return (
            <li
              key={m.id}
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{m.investorName}</span>
                <span className="text-xs text-[color:var(--muted-foreground)]">
                  Solicitado em {new Date(m.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              {m.topic && (
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  Assunto: {m.topic}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {options.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => confirm(m, iso)}
                    className="rounded-full px-4 py-2 text-xs font-medium disabled:opacity-50"
                    style={{ background: "var(--gold)", color: "#10233A" }}
                  >
                    Confirmar {new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy === m.id}
                  onClick={() => decline(m)}
                  className="rounded-full border px-4 py-2 text-xs disabled:opacity-50"
                  style={{ borderColor: "var(--border)" }}
                >
                  Recusar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {feedback && <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">{feedback}</p>}
      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--destructive)" }}>
          {error}
        </p>
      )}
    </section>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  count,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  count?: number;
  tone?: "default" | "danger";
}) {
  const danger = tone === "danger";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        danger
          ? "inline-flex items-center gap-1 rounded-md border border-[#C53030]/50 px-2 py-1.5 text-xs text-[#C53030] hover:bg-[rgba(197,48,48,0.1)]"
          : "inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)]"
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {typeof count === "number" && <span>{count}</span>}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}


function NewMeetingDialog({
  session,
  onClose,
  onCreated,
}: {
  session: ExecutiveSession;
  onClose: () => void;
  onCreated: () => void;
}) {
  const leads = useMemo(
    () => loadLeads().filter((l) => !l.responsibleExecutiveId || l.responsibleExecutiveId === session.userId),
    [session.userId],
  );
  const [investorId, setInvestorId] = useState(leads[0]?.id ?? "");
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [conflicts, setConflicts] = useState<{ summary: string; start: string; end: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [providerId, setProviderId] = useState<MeetingProviderId>(
    () => getDefaultProviderForExecutive(session.userId),
  );
  const [providerError, setProviderError] = useState<string | null>(null);

  const googleStore = getGoogleStore(session.userId);
  const googleConnected = googleStore.state === "connected";
  const provider = getProvider(providerId);

  async function submit(force = false) {
    if (!date || !time || submitting) return;
    setProviderError(null);
    // Provider Manual exige link.
    if (provider.id === "manual" && !meetUrl.trim()) {
      setProviderError("Informe o link da reunião.");
      return;
    }
    const iso = new Date(`${date}T${time}:00`).toISOString();
    const endIso = new Date(new Date(iso).getTime() + 60 * 60_000).toISOString();
    if (!force && googleConnected && provider.id === "google_meet") {
      const found = checkConflicts(session.userId, iso, endIso);
      if (found.length > 0) {
        setConflicts(
          found.map((e) => ({ summary: e.summary, start: e.start, end: e.end })),
        );
        return;
      }
    }
    const lead = leads.find((l) => l.id === investorId);
    const inv = lead
      ? { investorId: lead.id, investorName: lead.name, investorEmail: lead.email }
      : {
          investorId: `inv_${Date.now().toString(36)}`,
          investorName: customName || "Investidor",
          investorEmail: customEmail || undefined,
        };
    // Gera link via provider (nunca lança).
    const gen = tryGenerateProviderLink(provider.id, {
      executiveId: session.userId,
      manualUrl: meetUrl,
    });
    setSubmitting(true);
    const created = createMeeting({
      ...inv,
      executiveId: session.userId,
      executiveName: session.name,
      scheduledAt: iso,
      durationMin: 60,
      meetUrl: gen.url || undefined,
      meetingProvider: provider.id,
      meetingProviderStatus: gen.status,
      meetingProviderUrl: gen.url || undefined,
    });
    // Reutiliza Calendar sync apenas para google_meet quando conectado.
    if (provider.id === "google_meet" && googleConnected) {
      await trySyncCreate(created, {
        userId: session.userId,
        userName: session.name,
        userRole: "Executivo",
      });
    }
    setSubmitting(false);
    onCreated();
  }

  return (
    <Overlay onClose={onClose} title="Nova reunião">
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">
            Provedor da reunião
          </span>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value as MeetingProviderId)}
            className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
          >
            {MEETING_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.enabled}>
                {p.label}{p.comingSoon ? " (em breve)" : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-[color:var(--muted-foreground)]">
            Padrão do executivo: {getProvider(getDefaultProviderForExecutive(session.userId)).label}. Alterável apenas nesta reunião.
          </span>
        </label>
        {leads.length > 0 ? (
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Investidor</span>
            <select
              value={investorId}
              onChange={(e) => setInvestorId(e.target.value)}
              className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
            >
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value="">— Outro (informar nome) —</option>
            </select>
          </label>
        ) : null}
        {(leads.length === 0 || !investorId) && (
          <>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Nome do investidor</span>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Email do investidor (opcional)</span>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="convidado@exemplo.com"
                className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Data</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2" />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">Hora</span>
            <input {...TIME_INPUT_PROPS} value={time} onChange={(e) => setTime(sanitizeTimeValue(e.target.value))} aria-invalid={time !== "" && !isValidTimeValue(time)} className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2" />
          </label>
        </div>
        {provider.id === "manual" ? (
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">
              Link da reunião *
            </span>
            <input
              value={meetUrl}
              onChange={(e) => setMeetUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
            />
            {providerError && (
              <span className="mt-1 block text-[11px] text-[#C53030]">{providerError}</span>
            )}
          </label>
        ) : provider.id === "google_meet" ? (
          <div className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">
              Link Google Meet
            </span>
            <input
              readOnly
              value=""
              placeholder="Aguardando geração..."
              className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-[color:var(--muted-foreground)]"
            />
            <span className="mt-1 block text-[10px] text-[color:var(--muted-foreground)]">
              {googleConnected
                ? `Evento será criado no Google Calendar (${DEFAULT_TIMEZONE}) com Meet e convites automáticos.`
                : "O link será gerado automaticamente quando a integração estiver disponível."}
            </span>
          </div>
        ) : (
          <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-2 text-[11px] text-[color:var(--muted-foreground)]">
            {provider.label} — aguardando configuração da integração.
          </div>
        )}
        {conflicts.length > 0 && (
          <div className="rounded-md border border-[#C53030]/40 bg-[rgba(197,48,48,0.08)] px-3 py-2 text-[11px] text-[#C53030]">
            <p className="flex items-center gap-1 font-medium mb-1">
              <AlertTriangle className="h-3 w-3" /> Conflito de agenda detectado
            </p>
            <ul className="space-y-0.5">
              {conflicts.map((c, i) => (
                <li key={i}>
                  · {c.summary} — {new Date(c.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}–{new Date(c.end).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[color:var(--muted-foreground)]">Escolha outro horário ou confirme para agendar mesmo assim.</p>
          </div>
        )}
        <div className="flex gap-2">
          {conflicts.length > 0 && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit(true)}
              className="flex-1 rounded-full border border-[#C53030] px-4 py-2 text-sm text-[#C53030]"
            >
              Agendar mesmo assim
            </button>
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit(false)}
            className="flex-1 rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm text-[color:var(--navy-deep)] font-medium disabled:opacity-50"
          >
            {submitting ? "Agendando..." : "Agendar reunião"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}


function DetailsDialog({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const st = STATUS_STYLES[meeting.status];
  const when = new Date(meeting.scheduledAt);
  const notes = [...meeting.notes].sort((a, b) => (a.at < b.at ? -1 : 1));
  return (
    <Overlay onClose={onClose} title="Detalhes da reunião" wide>
      <div className="space-y-4">
        <header className="rounded-lg border border-[color:var(--border)] p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg">{meeting.investorName}</p>
            <span
              className="text-[10px] uppercase tracking-[0.22em] rounded-full px-2 py-0.5"
              style={{ color: st.fg, background: st.bg, border: `1px solid ${st.border}` }}
            >
              {st.label}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs text-[color:var(--muted-foreground)]">
            <div><dt className="uppercase tracking-[0.2em] text-[10px]">Data</dt><dd className="text-[color:var(--foreground)]">{when.toLocaleDateString("pt-BR")}</dd></div>
            <div><dt className="uppercase tracking-[0.2em] text-[10px]">Hora</dt><dd className="text-[color:var(--foreground)]">{when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</dd></div>
            <div className="col-span-2"><dt className="uppercase tracking-[0.2em] text-[10px]">Executivo responsável</dt><dd className="text-[color:var(--foreground)]">{meeting.executiveName}</dd></div>
            {meeting.meetUrl && (
              <div className="col-span-2">
                <dt className="uppercase tracking-[0.2em] text-[10px]">Link</dt>
                <dd>
                  <a href={meeting.meetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[color:var(--gold)] hover:underline break-all">
                    <Video className="h-3.5 w-3.5" /> {meeting.meetUrl}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </header>

        <section>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">Timeline de observações</p>
          {notes.length === 0 ? (
            <p className="rounded-md border border-dashed border-[color:var(--border)] px-3 py-4 text-center text-sm text-[color:var(--muted-foreground)]">
              Nenhuma observação registrada.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[280px] overflow-y-auto">
              {notes.map((n) => {
                const at = new Date(n.at);
                return (
                  <li key={n.id} className="rounded-md border border-[color:var(--border)] px-3 py-2">
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {at.toLocaleDateString("pt-BR")} · {at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {n.authorName}
                    </p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{n.text}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm">
            Fechar
          </button>
        </div>
      </div>
    </Overlay>
  );
}



function Overlay({ onClose, title, children, wide }: { onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(3,12,28,0.65)", backdropFilter: "blur(10px)" }} onClick={onClose} />
      <div className={`absolute inset-x-4 top-[8vh] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 ${wide ? "md:w-[560px]" : "md:w-[460px]"} rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] shadow-2xl max-h-[85vh] overflow-y-auto`}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--border)]">
          <p className="font-display">{title}</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Painel superior ---------- */

function SummaryPanel({
  todayCount, todayDone, todayRemaining,
  nextMeeting, onOpenNext,
  stats, onOpen,
}: {
  todayCount: number;
  todayDone: number;
  todayRemaining: number;
  nextMeeting: Meeting | null;
  onOpenNext: () => void;
  stats: Record<MeetingStatus, number>;
  onOpen: (m: Meeting) => void;
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <PanelCard title="Reuniões de hoje">
        <p className="font-display text-3xl">{todayCount}</p>
        <p className="text-xs text-[color:var(--muted-foreground)] mt-1">
          {todayDone} concluída{todayDone === 1 ? "" : "s"} · {todayRemaining} restante{todayRemaining === 1 ? "" : "s"}
        </p>
      </PanelCard>

      <PanelCard title="Próxima reunião">
        {nextMeeting ? (
          <div className="space-y-1">
            <p className="font-display text-base truncate">{nextMeeting.investorName}</p>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              {new Date(nextMeeting.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
            <span className="inline-block text-[10px] uppercase tracking-[0.2em] rounded-full px-2 py-0.5 mt-1"
              style={{ color: STATUS_STYLES[nextMeeting.status].fg, background: STATUS_STYLES[nextMeeting.status].bg, border: `1px solid ${STATUS_STYLES[nextMeeting.status].border}` }}>
              {nextMeeting.status}
            </span>
            <div>
              <button type="button" onClick={onOpenNext} className="mt-2 text-xs text-[color:var(--gold)] hover:underline">Abrir detalhes</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[color:var(--muted-foreground)]">Nenhuma reunião programada.</p>
        )}
      </PanelCard>

      <PanelCard title="Estatísticas">
        <ul className="text-xs space-y-1">
          {STATUS_FLOW.map((s) => (
            <li key={s} className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_STYLES[s].border }} />
                {s}
              </span>
              <span className="tabular-nums text-[color:var(--muted-foreground)]">{stats[s]}</span>
            </li>
          ))}
        </ul>
      </PanelCard>
    </div>
  );
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">{title}</p>
      {children}
    </div>
  );
}

function PendingLine({ label, items, onOpen }: { label: string; items: Meeting[]; onOpen: (m: Meeting) => void }) {
  return (
    <li>
      <div className="flex items-center justify-between">
        <span className="text-[color:var(--muted-foreground)]">{label}</span>
        <span className="tabular-nums">{items.length}</span>
      </div>
      {items.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-2">
          {items.slice(0, 2).map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onOpen(m)} className="truncate text-[11px] text-[color:var(--gold)] hover:underline text-left">
                · {m.investorName}
              </button>
            </li>
          ))}
          {items.length > 2 && <li className="text-[11px] text-[color:var(--muted-foreground)] pl-2">+{items.length - 2}</li>}
        </ul>
      )}
    </li>
  );
}

/* ---------- Calendário ---------- */

function CalendarView({
  month, items, onPrev, onNext, onOpen,
}: {
  month: Date;
  items: Meeting[];
  onPrev: () => void;
  onNext: () => void;
  onOpen: (m: Meeting) => void;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const startWeekday = firstDay.getDay(); // 0-6, dom-sab
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = ymd(new Date());

  const byDay: Record<string, Meeting[]> = {};
  for (const it of items) {
    const d = new Date(it.scheduledAt);
    if (d.getFullYear() === year && d.getMonth() === m) {
      const key = ymd(d);
      (byDay[key] ??= []).push(it);
    }
  }
  for (const k in byDay) {
    byDay[k].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  const cells: Array<{ day: number | null; key?: string }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = ymd(new Date(year, m, d));
    cells.push({ day: d, key });
  }

  const monthLabel = firstDay.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onPrev} aria-label="Mês anterior" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)]">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-base capitalize">{monthLabel}</p>
        <button type="button" onClick={onNext} aria-label="Próximo mês" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)]">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)] mb-1">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((w) => (
          <div key={w} className="px-2 py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (c.day === null) return <div key={i} className="min-h-[80px] rounded-md" />;
          const isToday = c.key === today;
          const dayMeetings = c.key ? byDay[c.key] ?? [] : [];
          return (
            <div
              key={i}
              className={`min-h-[80px] rounded-md border p-1 text-[11px] ${isToday ? "border-[color:var(--gold)] bg-[color:var(--gold)]/5" : "border-[color:var(--border)]"}`}
            >
              <div className={`px-1 mb-1 ${isToday ? "text-[color:var(--gold)] font-semibold" : "text-[color:var(--muted-foreground)]"}`}>
                {c.day}
              </div>
              <ul className="space-y-0.5">
                {dayMeetings.slice(0, 3).map((mt) => {
                  const st = STATUS_STYLES[mt.status];
                  const hh = new Date(mt.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <li key={mt.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(mt)}
                        className="w-full truncate rounded px-1 py-0.5 text-left"
                        style={{ background: st.bg, color: st.fg, border: `1px solid ${st.border}` }}
                        title={`${hh} · ${mt.investorName}`}
                      >
                        {hh} {mt.investorName}
                      </button>
                    </li>
                  );
                })}
                {dayMeetings.length > 3 && (
                  <li className="text-[10px] text-[color:var(--muted-foreground)] px-1">+{dayMeetings.length - 3}</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Agenda diária ---------- */

function AgendaView({
  date, onDateChange, items, onOpen,
}: {
  date: string;
  onDateChange: (d: string) => void;
  items: Meeting[];
  onOpen: (m: Meeting) => void;
}) {
  const dayItems = items
    .filter((m) => ymd(new Date(m.scheduledAt)) === date)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">Data</label>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-md border border-[color:var(--border)] bg-transparent px-3 py-1.5 text-sm"
        />
      </div>
      {dayItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] p-8 text-center text-sm text-[color:var(--muted-foreground)]">
          Nenhuma reunião agendada para esta data.
        </div>
      ) : (
        <ul className="space-y-2">
          {dayItems.map((m) => {
            const st = STATUS_STYLES[m.status];
            const hh = new Date(m.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            return (
              <li key={m.id} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-3 md:p-4">
                <div className="grid gap-3 md:grid-cols-[80px_minmax(0,1fr)_auto_auto] md:items-center">
                  <p className="font-display text-lg tabular-nums">{hh}</p>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm">{m.investorName}</p>
                    <p className="text-[11px] text-[color:var(--muted-foreground)] truncate">Executivo: {m.executiveName}</p>
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-[0.22em] rounded-full px-3 py-1 justify-self-start md:justify-self-auto"
                    style={{ color: st.fg, background: st.bg, border: `1px solid ${st.border}` }}
                  >
                    {st.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpen(m)}
                    className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs hover:bg-[color:var(--accent)]"
                  >
                    <Eye className="h-3.5 w-3.5" /> Abrir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- Histórico ---------- */

function HistoryView({ executiveId, items }: { executiveId: string; items: Meeting[] }) {
  const allowedInvestors = new Set(items.map((m) => m.investorId));
  const investorNames = new Map(items.map((m) => [m.investorId, m.investorName]));

  const events: PortalEvent[] = listEvents({
    types: [
      "meeting.created",
      "meeting.rescheduled",
      "meeting.completed",
      "meeting.cancelled",
    ],
  })
    .filter((e) => !e.investorId || allowedInvestors.has(e.investorId))
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  const describe = (e: PortalEvent): string => {
    const inv = e.investorId ? investorNames.get(e.investorId) ?? "reunião" : "reunião";
    switch (e.type) {
      case "meeting.created": return `Criou reunião com ${inv}.`;
      case "meeting.rescheduled": return `Reagendou/atualizou reunião com ${inv}.`;
      case "meeting.completed": return `Concluiu reunião com ${inv}.`;
      case "meeting.cancelled": return `Cancelou reunião com ${inv}.`;
      default: return `Ação em ${inv}.`;
    }
  };

  // Deriva também as observações a partir do estado atual (o bus não guarda notes).
  const noteEntries = items.flatMap((m) =>
    m.notes.map((n) => ({
      id: n.id,
      at: n.at,
      authorName: n.authorName,
      text: `Adicionou observação em reunião com ${m.investorName}.`,
    })),
  );

  type Row = { id: string; at: string; who: string; desc: string };
  const rows: Row[] = [
    ...events.map<Row>((e) => ({ id: e.id, at: e.at, who: e.actorId === executiveId ? "Você" : "Executivo", desc: describe(e) })),
    ...noteEntries.map<Row>((n) => ({ id: n.id, at: n.at, who: n.authorName, desc: n.text })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] p-8 text-center text-sm text-[color:var(--muted-foreground)]">
        Nenhum evento registrado.
      </div>
    );
  }

  return (
    <ol className="relative border-l border-[color:var(--border)] pl-4 space-y-3">
      {rows.map((r) => {
        const d = new Date(r.at);
        return (
          <li key={r.id} className="relative">
            <span className="absolute -left-[22px] top-1.5 h-2 w-2 rounded-full bg-[color:var(--gold)]" />
            <p className="text-xs text-[color:var(--muted-foreground)]">
              {d.toLocaleDateString("pt-BR")} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {r.who}
            </p>
            <p className="text-sm">{r.desc}</p>
          </li>
        );
      })}
    </ol>
  );
}