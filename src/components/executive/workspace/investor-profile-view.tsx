import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  FileText,
  MessageSquarePlus,
  Sparkles,
  MapPin,
  User as UserIcon,
  Clock,
  BookOpen,
  Play,
  ClipboardList,
} from "lucide-react";
import type { Investor } from "@/lib/executive-data";
import { STATUS_LABEL, formatRelative } from "@/lib/executive-data";
import { loadUsers, type ExecutiveSession } from "@/lib/executive-auth";
import { buildInvestorProfile, type InvestorProfile } from "@/lib/investor-profile";
import { onEvent } from "@/lib/events/bus";
import { addComment, listComments, type InvestorComment } from "@/lib/investor-comments";
import { generateInvestorReport } from "@/lib/investor-report";
import { InvestorMeetingDialog } from "@/components/executive/meetings/investor-meeting-dialog";
import {
  getPortalLeadStatus,
  setPortalLeadStatus,
  PORTAL_LEAD_STATUS_META,
  type PortalLeadStatus,
} from "@/lib/portal-lead-status";
import {
  listSimulations,
  getLastSimulation,
  openSimulationPdf,
  formatSimulationDate,
  type SimulationRecord,
} from "@/lib/simulator-history";
import { formatBRL } from "@/lib/simulator-products";
import { cn } from "@/lib/utils";

type TabKey =
  | "geral"
  | "jornada"
  | "timeline"
  | "reunioes"
  | "comentarios"
  | "ia"
  | "relatorio";

const TABS: { key: TabKey; label: string }[] = [
  { key: "geral", label: "Geral" },
  { key: "jornada", label: "Jornada" },
  { key: "timeline", label: "Linha do Tempo" },
  { key: "reunioes", label: "Reuniões" },
  { key: "comentarios", label: "Notas do Executivo" },
  { key: "ia", label: "IA Corporativa" },
  { key: "relatorio", label: "Relatório" },
];

const ORIGIN_LABEL: Record<string, string> = {
  green_sales: "Green Sales",
  portal: "Portal Velox",
  manual: "Manual do Investidor",
};

const MODULES = [
  { key: "manual", label: "Manual do Investidor" },
  { key: "material", label: "Material Institucional" },
  { key: "simulador", label: "Simulador Inteligente" },
  { key: "sede", label: "Nossa Estrutura" },
  { key: "revista", label: "Revista Velox" },
  { key: "cultura", label: "Cultura Velox" },
] as const;

export function InvestorProfileView({
  investor,
  session,
  onBack,
}: {
  investor: Investor;
  session: ExecutiveSession;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("geral");
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [tick, setTick] = useState(0);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const openNewMeeting = () => setMeetingOpen(true);

  useEffect(() => {
    setProfile(buildInvestorProfile(investor.id));
    return onEvent(() => {
      setProfile(buildInvestorProfile(investor.id));
      setTick((v) => v + 1);
    });
  }, [investor.id]);

  const executive = useMemo(
    () => loadUsers().find((u) => u.id === investor.assignedToUserId),
    [investor.assignedToUserId],
  );

  const initials = investor.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  return (
    <div className="animate-in fade-in duration-200">
      {/* Voltar */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao Workspace
      </button>

      {/* Cabeçalho */}
      <header className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-lg font-medium tracking-wider text-[color:var(--gold)]">
              {initials || "•"}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                Perfil Inteligente
              </p>
              <h1 className="font-display text-2xl md:text-3xl leading-tight truncate">
                {investor.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--muted-foreground)]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> {investor.city || "—"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  {ORIGIN_LABEL[investor.origin ?? "manual"] ?? "—"}
                  {executive?.name ? ` · ${executive.name}` : ""}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Entrada há {formatRelative(investor.lastActivity)}
                </span>
                <span className="inline-flex items-center rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--gold)]">
                  {STATUS_LABEL[investor.status]}
                </span>
              </div>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="flex flex-wrap gap-2 md:justify-end">
            {investor.origin === "portal" && (
              <PortalStatusSelector
                investorId={investor.id}
                actorId={session.userId}
              />
            )}
            <QuickBtn icon={Calendar} label="Nova reunião" onClick={openNewMeeting} primary />
            <QuickBtn
              icon={FileText}
              label="Gerar PDF"
              onClick={() => generateInvestorReport(investor)}
            />
          </div>
        </div>
      </header>

      {/* Abas */}
      <nav
        role="tablist"
        className="mt-6 flex flex-wrap gap-1 border-b border-[color:var(--border)]"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-xs uppercase tracking-[0.16em] transition border-b-2 -mb-px",
              tab === t.key
                ? "border-[color:var(--gold)] text-[color:var(--foreground)]"
                : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="mt-6">
        {tab === "geral" && <TabGeral investor={investor} executive={executive?.name} />}
        {tab === "jornada" && <TabJornada investor={investor} />}
        {tab === "timeline" && <TabTimeline profile={profile} />}
        {tab === "reunioes" && (
          <TabReunioes profile={profile} onNewMeeting={openNewMeeting} tick={tick} />
        )}
        {tab === "comentarios" && <TabComentarios investor={investor} session={session} />}
        {tab === "ia" && <TabIA profile={profile} investor={investor} />}
        {tab === "relatorio" && <TabRelatorio investor={investor} profile={profile} />}
      </section>

      {meetingOpen && (
        <InvestorMeetingDialog
          investor={investor}
          session={session}
          onClose={() => setMeetingOpen(false)}
          onCreated={() => {
            setMeetingOpen(false);
            setProfile(buildInvestorProfile(investor.id));
          }}
        />
      )}
    </div>
  );
}

function QuickBtn({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof Calendar;
  label: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs transition",
        primary
          ? "border-[color:var(--gold)]/60 bg-[color:var(--accent)] text-[color:var(--foreground)] hover:border-[color:var(--gold)]"
          : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function PortalStatusSelector({
  investorId,
  actorId,
}: {
  investorId: string;
  actorId: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PortalLeadStatus>(() =>
    getPortalLeadStatus(investorId),
  );
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setStatus(getPortalLeadStatus(investorId));
  }, [investorId]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const meta = PORTAL_LEAD_STATUS_META[status];
  const options: PortalLeadStatus[] = ["novo", "em_andamento", "encerrado"];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs transition",
          meta.border,
          meta.text,
          "hover:brightness-125",
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
        {meta.label}
        <span className="text-[color:var(--muted-foreground)]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-52 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--navy)] shadow-2xl">
          {options.map((opt) => {
            const m = PORTAL_LEAD_STATUS_META[opt];
            const active = opt === status;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setPortalLeadStatus(investorId, opt, actorId);
                  setStatus(opt);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition",
                  active
                    ? "bg-[color:var(--accent)] text-[color:var(--foreground)]"
                    : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/60 hover:text-[color:var(--foreground)]",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", m.dot)} />
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Aba Geral ---------- */
function TabGeral({ investor, executive }: { investor: Investor; executive?: string }) {
  const originLabel = ORIGIN_LABEL[investor.origin ?? "manual"] ?? "—";
  const originValue = executive
    ? `${originLabel} · ${executive}${
        investor.origin !== "portal" ? ` (/manual/${slugify(executive)})` : ""
      }`
    : originLabel;
  const rows: [string, React.ReactNode][] = [
    ["Nome completo", investor.name],
    ["Telefone", investor.phone || "—"],
    ["Email", investor.email || "—"],
    ["Cidade", investor.city || "—"],
    ["Origem / Executivo", originValue],
    ["Status atual", STATUS_LABEL[investor.status]],
    ["Diagnóstico", investor.diagnostic],
    ["Interações com IA", String(investor.aiInteractions)],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-5 py-4"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            {k}
          </p>
          <p className="mt-1 text-sm text-[color:var(--foreground)] break-words">{v}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Aba Jornada ---------- */
function TabJornada({ investor }: { investor: Investor }) {
  const progresses = deriveModuleProgress(investor);
  const [simOpen, setSimOpen] = useState(false);
  const [sims, setSims] = useState<SimulationRecord[]>([]);
  useEffect(() => {
    setSims(listSimulations(investor.id));
  }, [investor.id, simOpen]);
  const last = sims[0] ?? getLastSimulation(investor.id);
  const simulatorStatus = last
    ? `Última simulação realizada em ${formatSimulationDate(last.createdAt)}.`
    : "Nenhuma simulação realizada.";
  return (
    <>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {MODULES.map((m) => {
        const p = progresses[m.key];
        const isSim = m.key === "simulador";
        return (
          <article
            key={m.key}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                  Módulo
                </p>
                <h3 className="mt-0.5 font-display text-base">{m.label}</h3>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                  p.status === "concluido"
                    ? "border-emerald-500/40 text-emerald-400"
                    : p.status === "em_andamento"
                      ? "border-[color:var(--gold)]/50 text-[color:var(--gold)]"
                      : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                )}
              >
                {p.status === "concluido"
                  ? "Concluído"
                  : p.status === "em_andamento"
                    ? "Em andamento"
                    : "Não iniciado"}
              </span>
            </div>
            {isSim ? (
              <div className="mt-4 space-y-3">
                <p className="text-[12px] leading-relaxed text-[color:var(--muted-foreground)]">
                  {simulatorStatus}
                </p>
                {sims.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSimOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-3.5 py-2 text-xs hover:border-[color:var(--gold)] transition"
                  >
                    <FileText className="h-3.5 w-3.5" /> Ver Simulações
                    <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] text-[color:var(--gold)]">
                      {sims.length}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--accent)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--gold)] transition-all"
                    style={{ width: `${p.pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
                  <span>{p.pct}% concluído</span>
                  <span>{p.lastActivity}</span>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
      {simOpen && (
        <SimulationsHistoryDialog
          simulations={sims}
          onClose={() => setSimOpen(false)}
        />
      )}
    </>
  );
}

function SimulationsHistoryDialog({
  simulations,
  onClose,
}: {
  simulations: SimulationRecord[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="absolute inset-x-4 top-[6vh] bottom-[6vh] mx-auto flex max-w-3xl flex-col overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              Histórico de simulações
            </p>
            <h3 className="font-display text-lg">Simulador Inteligente</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] hover:border-[color:var(--gold)]/60 transition"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {simulations.length === 0 ? (
            <EmptyState icon={FileText} text="Nenhuma simulação registrada." />
          ) : (
            <ul className="space-y-3">
              {simulations.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/60 px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                        {formatSimulationDate(s.createdAt)}
                      </p>
                      <p className="mt-1 font-display text-base">
                        {formatBRL(s.total)}{" "}
                        <span className="text-xs font-normal text-[color:var(--muted-foreground)]">
                          / mês · {formatBRL(s.annual)} / ano
                        </span>
                      </p>
                      <p className="mt-1 text-[12px] text-[color:var(--muted-foreground)]">
                        {s.products.length} produto(s):{" "}
                        {s.products
                          .slice(0, 4)
                          .map((p) => p.name)
                          .join(", ")}
                        {s.products.length > 4 ? "…" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSimulationPdf(s)}
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-3.5 py-2 text-xs hover:border-[color:var(--gold)] transition"
                    >
                      <FileText className="h-3.5 w-3.5" /> Abrir Relatório
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function deriveModuleProgress(inv: Investor): Record<
  (typeof MODULES)[number]["key"],
  { pct: number; status: "nao_iniciado" | "em_andamento" | "concluido"; lastActivity: string }
> {
  const rel = formatRelative(inv.lastActivity);
  const manualPct = inv.readingPct;
  const manualStatus =
    manualPct >= 100 ? "concluido" : manualPct > 0 ? "em_andamento" : "nao_iniciado";
  return {
    manual: { pct: manualPct, status: manualStatus, lastActivity: rel },
    material: {
      pct: manualPct >= 60 ? 40 : 0,
      status: manualPct >= 60 ? "em_andamento" : "nao_iniciado",
      lastActivity: manualPct >= 60 ? rel : "—",
    },
    simulador: {
      pct: inv.diagnostic === "concluído" ? 100 : inv.diagnostic === "em andamento" ? 50 : 0,
      status:
        inv.diagnostic === "concluído"
          ? "concluido"
          : inv.diagnostic === "em andamento"
            ? "em_andamento"
            : "nao_iniciado",
      lastActivity: inv.diagnostic === "não iniciado" ? "—" : rel,
    },
    sede: { pct: 0, status: "nao_iniciado", lastActivity: "—" },
    revista: { pct: 0, status: "nao_iniciado", lastActivity: "—" },
    cultura: { pct: 0, status: "nao_iniciado", lastActivity: "—" },
  };
}

/* ---------- Aba Linha do Tempo ---------- */
function TabTimeline({ profile }: { profile: InvestorProfile | null }) {
  if (!profile || profile.timeline.length === 0) {
    return <EmptyState icon={Clock} text="Nenhuma atividade registrada até o momento." />;
  }
  return (
    <ol className="space-y-3 border-l border-[color:var(--border)] pl-5">
      {profile.timeline.map((t) => (
        <li key={`${t.kind}_${t.id}`} className="relative">
          <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--gold)]" />
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3">
            <p className="text-sm">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                {t.description}
              </p>
            )}
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              {new Date(t.at).toLocaleString("pt-BR")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Aba Reuniões ---------- */
function TabReunioes({
  profile,
  onNewMeeting,
  tick,
}: {
  profile: InvestorProfile | null;
  onNewMeeting: () => void;
  tick: number;
}) {
  void tick;
  const now = Date.now();
  const upcoming = (profile?.meetings ?? []).filter(
    (m) => new Date(m.scheduledAt).getTime() >= now && m.status !== "Cancelada",
  );
  const past = (profile?.meetings ?? []).filter(
    (m) => new Date(m.scheduledAt).getTime() < now || m.status === "Concluída",
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Histórico de reuniões
        </p>
        <button
          type="button"
          onClick={onNewMeeting}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-3.5 py-2 text-xs hover:border-[color:var(--gold)] transition"
        >
          <Calendar className="h-3.5 w-3.5" /> Nova reunião
        </button>
      </div>

      <MeetingList title="Próximas" meetings={upcoming} empty="Nenhuma reunião agendada." />
      <MeetingList title="Realizadas" meetings={past} empty="Nenhuma reunião registrada." />
    </div>
  );
}

function MeetingList({
  title,
  meetings,
  empty,
}: {
  title: string;
  meetings: InvestorProfile["meetings"];
  empty: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-[color:var(--muted-foreground)]">{title}</p>
      {meetings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-xs text-[color:var(--muted-foreground)]">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {meetings.map((m) => (
            <li
              key={m.id}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{new Date(m.scheduledAt).toLocaleString("pt-BR")}</span>
                <span className="text-[color:var(--gold)] text-xs">{m.status}</span>
              </div>
              {m.notes.length > 0 && (
                <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
                  {m.notes.length} anotação(ões) pós-reunião
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Aba Comentários ---------- */
function TabComentarios({
  investor,
  session,
}: {
  investor: Investor;
  session: ExecutiveSession;
}) {
  const [items, setItems] = useState<InvestorComment[]>([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    setItems(listComments(investor.id));
  }, [investor.id]);

  const submit = () => {
    const t = body.trim();
    if (!t) return;
    addComment({
      investorId: investor.id,
      authorId: session.userId,
      authorName: session.name,
      body: t,
    });
    setBody("");
    setItems(listComments(investor.id));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Registre uma nota interna: follow-up, ligação, informação importante…"
          rows={3}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-foreground)]/60"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={!body.trim()}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-3.5 py-2 text-xs hover:border-[color:var(--gold)] transition disabled:opacity-40"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> Registrar nota
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={MessageSquarePlus} text="Nenhuma nota interna registrada ainda." />
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3"
            >
              <div className="flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
                <span>{c.authorName}</span>
                <span>{new Date(c.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Aba IA Corporativa ---------- */
function TabIA({
  profile,
  investor,
}: {
  profile: InvestorProfile | null;
  investor: Investor;
}) {
  const hasSignal =
    (profile?.timeline.length ?? 0) > 0 || investor.aiInteractions > 0 || investor.readingPct > 0;
  if (!hasSignal) {
    return (
      <EmptyState
        icon={Sparkles}
        text="A IA Corporativa ainda não coletou sinais suficientes deste investidor."
      />
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <AICard
        icon={BookOpen}
        title="Resumo automático"
        body={`Investidor com ${investor.readingPct}% do Manual do Investidor concluído. Atualmente no capítulo "${investor.currentChapter}", com ${investor.aiInteractions} interações registradas com a IA.`}
      />
      <AICard
        icon={Sparkles}
        title="Principais interesses"
        body="Análise preliminar aponta interesse por modelos operacionais de baixa complexidade e cenários de receita consultiva."
      />
      <AICard
        icon={Play}
        title="Materiais consumidos"
        body={
          profile && profile.events.length > 0
            ? `${profile.events.length} evento(s) registrados na jornada — priorize retomar pelo último ponto de contato.`
            : "Nenhum material adicional consumido além do Manual."
        }
      />
      <AICard
        icon={ClipboardList}
        title="Sugestão de abordagem"
        body="Iniciar a conversa reconhecendo o progresso na jornada e conduzir para o diagnóstico consultivo antes de propor a reunião comercial."
      />
    </div>
  );
}

function AICard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-2 text-[color:var(--gold)]">
        <Icon className="h-4 w-4" />
        <h3 className="font-display text-sm">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)] leading-relaxed">{body}</p>
    </article>
  );
}

/* ---------- Aba Relatório ---------- */
function TabRelatorio({
  investor,
  profile,
}: {
  investor: Investor;
  profile: InvestorProfile | null;
}) {
  const sections = [
    { title: "Resumo do Investidor", value: `${investor.name} · ${investor.city}` },
    { title: "Status atual", value: STATUS_LABEL[investor.status] },
    {
      title: "Jornada",
      value: `Manual ${investor.readingPct}% · Capítulo: ${investor.currentChapter}`,
    },
    {
      title: "Reuniões",
      value: `${profile?.meetings.length ?? 0} reunião(ões) registradas`,
    },
    {
      title: "Comentários",
      value: `${listComments(investor.id).length} observação(ões) internas`,
    },
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Relatório Executivo
        </p>
        <h2 className="mt-1 font-display text-xl">{investor.name}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sections.map((s) => (
            <div key={s.title}>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                {s.title}
              </p>
              <p className="mt-0.5 text-sm">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => generateInvestorReport(investor)}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-4 py-2.5 text-xs hover:border-[color:var(--gold)] transition"
        >
          <FileText className="h-3.5 w-3.5" /> Gerar PDF
        </button>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */
function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof Sparkles;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/20 p-12 text-center">
      <Icon className="mx-auto h-6 w-6 text-[color:var(--muted-foreground)]" />
      <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{text}</p>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(" ")
    .filter(Boolean)[0] ?? s;
}