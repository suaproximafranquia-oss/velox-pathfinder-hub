import { useCallback, useEffect, useMemo, useState } from "react";
import { BEHAVIOR_LABEL, journeySummary } from "@/lib/journey/insights";
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
import { PORTAL_ACCESS_POLL_MS } from "@/lib/portal-access";
import {
  getInvestorJourneyState,
  type InvestorJourneyState,
} from "@/lib/portal-access.functions";
import { loadUsers, type ExecutiveSession } from "@/lib/executive-auth";
import { buildInvestorProfile, type InvestorProfile } from "@/lib/investor-profile";
import { onEvent } from "@/lib/events/bus";
import { listComments, type InvestorComment } from "@/lib/investor-comments";
import {
  addInvestorNoteFn,
  listInvestorNotesFn,
  type InvestorNoteView,
} from "@/lib/crm/investor-notes.functions";
import { openInvestorReport } from "@/lib/investor-report-lazy";
import { InvestorMeetingDialog } from "@/components/executive/meetings/investor-meeting-dialog";
import {
  LEAD_STATE_META,
  markLeadViewed,
  onLeadStateChange,
  resolveLeadState,
  closeLead,
  reopenLead,
  type LeadState,
} from "@/lib/lead-state";
import {
  readLeadFicha,
  saveLeadFicha,
  type LeadFicha,
} from "@/lib/workspace-lead-edit";
import {
  listSimulations,
  openSimulationPdf,
  formatSimulationDate,
  type SimulationRecord,
} from "@/lib/simulator-history";
import { formatBRL } from "@/lib/simulator-products";
import { cn } from "@/lib/utils";
import { E20Panel } from "@/components/executive/workspace/e20-panel";
import { E0Panel } from "@/components/executive/workspace/e0-panel";

type TabKey =
  | "geral"
  | "jornada"
  | "reunioes"
  | "comentarios"
  | "ia"
  | "relatorio";

const TABS: { key: TabKey; label: string }[] = [
  { key: "geral", label: "Geral" },
  { key: "jornada", label: "Jornada" },
  { key: "reunioes", label: "Reuniões" },
  { key: "comentarios", label: "Notas do Executivo" },
  { key: "ia", label: "IA Corporativa" },
  { key: "relatorio", label: "Relatório" },
];

const ORIGIN_LABEL: Record<string, string> = {
  green_sales: "Green Sales",
  redistribuicao: "Redistribuição",
  portal: "Portal Velox",
  manual: "Manual do Investidor",
};

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
            <LeadStateBadge investor={investor} actorId={session.userId} />
            <QuickBtn icon={Calendar} label="Nova reunião" onClick={openNewMeeting} primary />
            <QuickBtn
              icon={FileText}
              label="Gerar PDF"
              onClick={() => void openInvestorReport(investor)}
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
        {tab === "geral" && <TabGeral investor={investor} session={session} />}
        {/* Jornada consolidada: módulos + histórico cronológico em uma única aba. */}
        {tab === "jornada" && (
          <div className="space-y-6">
            {/* Status auditável do primeiro contato (leitura pura). */}
            <E0Panel investorId={investor.id} />
            {/* Evento paralelo à cadência: convite formal ao Portal. */}
            <E20Panel investorId={investor.id} />
            <TabJornada investor={investor} />
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                Histórico da jornada
              </p>
              <TabTimeline profile={profile} />
            </div>
          </div>
        )}
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

function LeadStateBadge({
  investor,
  actorId,
}: {
  investor: Investor;
  actorId: string;
}) {
  const [state, setState] = useState<LeadState>(() => resolveLeadState(investor));
  useEffect(() => {
    // Abrir o perfil já caracteriza visualização: verde → amarelo.
    markLeadViewed(investor.id, actorId);
    setState(resolveLeadState({ id: investor.id }));
    return onLeadStateChange((id) => {
      if (!id || id === investor.id) setState(resolveLeadState({ id: investor.id }));
    });
  }, [investor.id, actorId]);
  const meta = LEAD_STATE_META[state];
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs",
        meta.border,
        meta.text,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/* ---------- Aba Geral ---------- */
/**
 * DEF 2.5.3 §6 — ficha totalmente editável. Toda alteração é gravada na
 * base única e propagada na hora para CRM, Timeline, Auditoria, Backup e
 * Central de Alertas.
 */
function TabGeral({
  investor,
  session,
}: {
  investor: Investor;
  session: ExecutiveSession;
}) {
  const users = useMemo(() => loadUsers(), []);
  const [ficha, setFicha] = useState<LeadFicha | null>(null);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<LeadState>(() => resolveLeadState(investor));

  useEffect(() => {
    setFicha(readLeadFicha(investor.id));
    setState(resolveLeadState(investor));
  }, [investor.id]);

  if (!ficha) {
    return (
      <p className="text-sm text-[color:var(--muted-foreground)]">
        Ficha indisponível para este registro.
      </p>
    );
  }

  const set = (patch: Partial<LeadFicha>) => {
    setSaved(false);
    setFicha((f) => (f ? { ...f, ...patch } : f));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ficha) return;
    saveLeadFicha({
      investorId: investor.id,
      ficha,
      actorId: session.userId,
      actorName: session.name,
      actorRole: session.activeRole,
    });
    setSaved(true);
  };

  const changeState = (next: LeadState) => {
    if (next === "encerrado") closeLead(investor.id, session.userId);
    else if (state === "encerrado") reopenLead(investor.id, session.userId);
    else markLeadViewed(investor.id, session.userId);
    setState(next);
  };

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Field label="Nome completo" value={ficha.name} onChange={(v) => set({ name: v })} />
      <Field
        label="WhatsApp / Telefone"
        value={ficha.whatsapp}
        onChange={(v) => set({ whatsapp: v })}
      />
      <Field label="E-mail" value={ficha.email} onChange={(v) => set({ email: v })} />
      <Field label="Cidade" value={ficha.city} onChange={(v) => set({ city: v })} />

      <SelectField
        label="Origem"
        value={ficha.scope}
        onChange={(v) => set({ scope: v as LeadFicha["scope"] })}
        options={[
          { value: "green_sales", label: ORIGIN_LABEL.green_sales },
          { value: "redistribuicao", label: ORIGIN_LABEL.redistribuicao },
          { value: "portal", label: ORIGIN_LABEL.portal },
        ]}
      />
      <SelectField
        label="Executivo responsável"
        value={ficha.responsibleExecutiveId ?? ""}
        onChange={(v) => set({ responsibleExecutiveId: v || null })}
        options={[
          { value: "", label: "Administrador do Portal" },
          ...users.map((u) => ({ value: u.id, label: u.name })),
        ]}
      />
      <SelectField
        label="Status"
        value={state}
        onChange={(v) => changeState(v as LeadState)}
        options={[
          { value: "novo", label: LEAD_STATE_META.novo.label },
          { value: "em_andamento", label: LEAD_STATE_META.em_andamento.label },
          { value: "encerrado", label: LEAD_STATE_META.encerrado.label },
        ]}
      />
      <ReadOnly label="Status da jornada" value={STATUS_LABEL[investor.status]} />

      <div className="md:col-span-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-5 py-4">
        <label className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Observações
        </label>
        <textarea
          value={ficha.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={3}
          className="mt-2 w-full resize-y bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-foreground)]/50"
          placeholder="Observações operacionais sobre o relacionamento"
        />
      </div>

      <ReadOnly label="Diagnóstico" value={investor.diagnostic} />
      <ReadOnly label="Interações com IA" value={String(investor.aiInteractions)} />

      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-5 py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--foreground)] hover:border-[color:var(--gold)] transition"
        >
          Salvar alterações
        </button>
        {saved && (
          <span className="text-xs text-emerald-400">
            Ficha atualizada e sincronizada.
          </span>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-5 py-4 block">
      <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm text-[color:var(--foreground)] outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-5 py-4 block">
      <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm text-[color:var(--foreground)] outline-none [&>option]:bg-[color:var(--card)] [&>option]:text-[color:var(--foreground)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm text-[color:var(--foreground)] break-words">{value}</p>
    </div>
  );
}

/* ---------- Aba Jornada ---------- */

type JourneyCard = {
  key: string;
  label: string;
  /** Rótulo oficial do estado deste módulo. */
  status: string;
  tone: "neutro" | "andamento" | "concluido";
  /** Percentual só existe onde o conteúdo realmente o produz. */
  percent?: number;
  detail: string;
  lastAt: string | null;
};

const NEVER = "Sem acesso registrado";

function fmtWhen(at: string | null): string {
  if (!at) return "—";
  const d = new Date(at);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function buildJourneyCards(state: InvestorJourneyState): JourneyCard[] {
  const progressLabel = (s: "nao_iniciado" | "em_andamento" | "concluido") =>
    s === "concluido" ? "Concluído" : s === "em_andamento" ? "Em andamento" : "Não iniciado";
  const tone = (s: string): JourneyCard["tone"] =>
    s === "concluido" ? "concluido" : s === "nao_iniciado" || s === "nao_acessado" ? "neutro" : "andamento";
  const acesso = (m: { status: string; lastAt: string | null }, key: string, label: string): JourneyCard => ({
    key,
    label,
    status: m.status === "nao_acessado" ? "Não acessado" : "Acessado",
    tone: tone(m.status),
    detail: m.status === "nao_acessado" ? NEVER : `Último acesso em ${fmtWhen(m.lastAt)}.`,
    lastAt: m.lastAt,
  });

  return [
    {
      key: "manual",
      label: "Manual do Investidor",
      status: progressLabel(state.manual.status),
      tone: tone(state.manual.status),
      percent: state.manual.percent,
      detail:
        state.manual.status === "nao_iniciado"
          ? NEVER
          : state.manual.chapter
            ? `Capítulo atual: ${state.manual.chapter}.`
            : "Leitura em curso.",
      lastAt: state.manual.lastAt ?? state.manual.completedAt,
    },
    {
      key: "material",
      label: "Material Institucional",
      status: progressLabel(state.material.status),
      tone: tone(state.material.status),
      detail:
        state.material.status === "nao_iniciado"
          ? NEVER
          : `Primeiro acesso em ${fmtWhen(state.material.firstAt)}.`,
      lastAt: state.material.lastAt,
    },
    {
      key: "simulador",
      label: "Simulador Inteligente",
      status:
        state.simulador.status === "simulado"
          ? "Simulação realizada"
          : state.simulador.status === "iniciado"
            ? "Iniciado"
            : "Não iniciado",
      tone:
        state.simulador.status === "simulado"
          ? "concluido"
          : state.simulador.status === "iniciado"
            ? "andamento"
            : "neutro",
      detail:
        state.simulador.simulations > 0
          ? `${state.simulador.simulations} ${state.simulador.simulations === 1 ? "simulação realizada" : "simulações realizadas"} — última em ${fmtWhen(state.simulador.lastSimulationAt)}.`
          : state.simulador.status === "iniciado"
            ? "Abriu o simulador, ainda sem simulação concluída."
            : NEVER,
      lastAt: state.simulador.lastAt,
    },
    acesso(state.estrutura, "estrutura", "Nossa Estrutura"),
    acesso(state.revista, "revista", "Revista Velox"),
    acesso(state.principios, "principios", "Cultura Velox"),
  ];
}

/**
 * A Jornada lê o estado consolidado no SERVIDOR e se atualiza sozinha:
 * nenhum número vem do navegador e nenhuma tela exige F5.
 */
function TabJornada({ investor }: { investor: Investor }) {
  const [state, setState] = useState<InvestorJourneyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [simOpen, setSimOpen] = useState(false);
  const [sims, setSims] = useState<SimulationRecord[]>([]);

  useEffect(() => {
    setSims(listSimulations(investor.id));
  }, [investor.id, simOpen]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const next = await getInvestorJourneyState({ data: { investorId: investor.id } });
        if (alive) setState(next);
      } catch {
        /* rede instável: mantém o último estado conhecido */
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), PORTAL_ACCESS_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [investor.id]);

  if (loading && !state) {
    return <EmptyState icon={Clock} text="Carregando a jornada registrada no servidor…" />;
  }
  if (!state) {
    return <EmptyState icon={Clock} text="Nenhuma jornada registrada para este investidor." />;
  }

  const cards = buildJourneyCards(state);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <article
            key={c.key}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                  Módulo
                </p>
                <h3 className="mt-0.5 font-display text-base">{c.label}</h3>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                  c.tone === "concluido"
                    ? "border-emerald-500/40 text-emerald-400"
                    : c.tone === "andamento"
                      ? "border-[color:var(--gold)]/50 text-[color:var(--gold)]"
                      : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                )}
              >
                {c.status}
              </span>
            </div>
            {typeof c.percent === "number" && (
              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--accent)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--gold)] transition-all"
                    style={{ width: `${c.percent}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
                  {c.percent}% concluído
                </p>
              </div>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-[color:var(--muted-foreground)]">
              {c.detail}
            </p>
            {c.key === "simulador" && sims.length > 0 && (
              <button
                type="button"
                onClick={() => setSimOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-3.5 py-2 text-xs hover:border-[color:var(--gold)] transition"
              >
                <FileText className="h-3.5 w-3.5" /> Ver Simulações
                <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] text-[color:var(--gold)]">
                  {sims.length}
                </span>
              </button>
            )}
          </article>
        ))}
      </div>
      {simOpen && (
        <SimulationsHistoryDialog simulations={sims} onClose={() => setSimOpen(false)} />
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

/* ---------- Aba Linha do Tempo ---------- */
function TabTimeline({ profile }: { profile: InvestorProfile | null }) {
  const journey = profile ? journeySummary(profile.id) : null;
  if (!profile || (profile.timeline.length === 0 && !journey)) {
    return <EmptyState icon={Clock} text="Nenhuma atividade registrada até o momento." />;
  }
  return (
    <div className="space-y-5">
      {journey && (
        /* Inteligência interna do Journey Engine — nunca exibida ao investidor. */
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/60 px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            Leitura interna da jornada
          </p>
          <p className="mt-1 text-sm">{journey.autoSummary}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <JourneyStat label="Estágio" value={journey.stageLabel} />
            <JourneyStat label="Engajamento" value={`${journey.engagementScore} · ${journey.engagementLabel}`} />
            <JourneyStat label="Sessões" value={`${journey.sessions} (${journey.returns} retornos)`} />
            <JourneyStat label="Tempo efetivo" value={`${journey.effectiveMinutes} min`} />
          </div>
          {journey.behaviors.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {journey.behaviors.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] text-[color:var(--muted-foreground)]"
                >
                  {BEHAVIOR_LABEL[b]}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
            {journey.contactReadiness.ready
              ? `Momento favorável para contato. ${journey.contactReadiness.reason}`
              : journey.contactReadiness.reason}
          </p>
          {journey.lastSessionSummary && (
            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
              Última sessão: {journey.lastSessionSummary}
            </p>
          )}
        </div>
      )}
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
    </div>
  );
}

function JourneyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
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

/* ---------- Aba Notas do Executivo ---------- */
/**
 * As notas oficiais vivem no BACKEND: o mesmo executivo encontra as
 * mesmas notas em qualquer computador. As notas antigas guardadas no
 * navegador continuam visíveis apenas como LEGADO — nunca são apagadas
 * e nunca recebem novos registros.
 */
function TabComentarios({ investor }: { investor: Investor; session: ExecutiveSession }) {
  const [items, setItems] = useState<InvestorNoteView[]>([]);
  const [legacy, setLegacy] = useState<InvestorComment[]>([]);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setItems(await listInvestorNotesFn({ data: { leadId: investor.id } }));
    } catch {
      setItems([]);
    }
  }, [investor.id]);

  useEffect(() => {
    setLegacy(listComments(investor.id));
    void reload();
  }, [investor.id, reload]);

  const submit = async () => {
    const t = body.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await addInvestorNoteFn({ data: { leadId: investor.id, body: t } });
      setBody("");
      await reload();
    } finally {
      setSaving(false);
    }
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
            onClick={() => void submit()}
            disabled={!body.trim() || saving}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-3.5 py-2 text-xs hover:border-[color:var(--gold)] transition disabled:opacity-40"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> Registrar nota
          </button>
        </div>
      </div>

      {items.length === 0 && legacy.length === 0 ? (
        <EmptyState icon={MessageSquarePlus} text="Nenhuma nota interna registrada ainda." />
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpen(c)}
                className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3 text-left transition hover:border-[color:var(--gold)]/60"
              >
                <div className="flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
                  <span>{c.authorName ?? "Executivo"}</span>
                  <span>{new Date(c.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap line-clamp-3">{c.body}</p>
                {c.body.length > 160 ? (
                  <span className="mt-1 block text-[11px] text-[color:var(--muted-foreground)]">
                    … ver registro completo
                  </span>
                ) : null}
              </button>
            </li>
          ))}

          {legacy.map((c) => (
            <li
              key={`legado-${c.id}`}
              className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/20 px-4 py-3"
            >
              <div className="flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
                <span>
                  {c.authorName} ·{" "}
                  <span className="uppercase tracking-wide opacity-70">legado</span>
                </span>
                <span>{new Date(c.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap opacity-80">{c.body}</p>
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
          onClick={() => void openInvestorReport(investor)}
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
