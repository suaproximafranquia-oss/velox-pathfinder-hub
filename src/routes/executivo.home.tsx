import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ExternalLink,
  Calculator,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
  CalendarClock,
  Users,
  Clock,
  AlertCircle,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  ROLE_LABEL,
  canViewAllInvestors,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { PLATFORM_MODULES, type PlatformModule } from "@/config/modules";
import { WORKSPACE } from "@/config/workspace";
import { PendingsCard } from "@/components/executive/pendings-card";
import { SimulatorModal } from "@/components/simulator/simulator-modal";
import { derivePendings } from "@/lib/pendings";
import { listMeetings, MEETING_STATUS_TONE, type Meeting } from "@/lib/meetings";
import { MOCK_INVESTORS, STATUS_LABEL, formatRelative } from "@/lib/executive-data";

export const Route = createFileRoute("/executivo/home")({
  head: () => ({
    meta: [
      { title: "Portal Velox — Assistente Executivo" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);

  if (!session) return null;

  const visibleModules = PLATFORM_MODULES.filter(
    (m) => !m.requiresRole || m.requiresRole.includes(session.activeRole),
  );

  return (
    <ExecutiveShell session={session} title={`Bem-vindo, ${session.name.split(" ")[0]}`}>
      <ExecutiveBriefing session={session} onSimulate={() => setSimulatorOpen(true)} />

      <section className="mb-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <TodayAgenda session={session} />
        <PendingsCard executiveId={session.userId} />
      </section>

      <section className="mb-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <PortfolioSnapshot session={session} />
        <SimulatorAside onStart={() => setSimulatorOpen(true)} />
      </section>

      <section>
        <SectionHeader
          eyebrow="Recursos"
          title="Acessos rápidos do workspace"
          subtitle={`${visibleModules.length} módulos disponíveis para o perfil ${ROLE_LABEL[session.activeRole]}.`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleModules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
        </div>
        <p className="mt-6 text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]/70">
          {WORKSPACE.poweredBy}
        </p>
      </section>

      <SimulatorModal open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
    </ExecutiveShell>
  );
}

function greeting(name: string) {
  const h = new Date().getHours();
  const period = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${period}, ${name.split(" ")[0]}`;
}

function useExecutiveScope(session: ExecutiveSession) {
  return useMemo(() => {
    const all = canViewAllInvestors(session.activeRole);
    const investors = all
      ? MOCK_INVESTORS
      : MOCK_INVESTORS.filter((i) => i.assignedToUserId === session.userId);
    const meetings = listMeetings(all ? {} : { executiveId: session.userId });
    const pendings = derivePendings({ executiveId: session.userId });
    return { investors, meetings, pendings, viewAll: all };
  }, [session.userId, session.activeRole]);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function ExecutiveBriefing({
  session,
  onSimulate,
}: {
  session: ExecutiveSession;
  onSimulate: () => void;
}) {
  const { investors, meetings, pendings } = useExecutiveScope(session);
  const today = startOfToday().getTime();
  const tomorrow = today + 24 * 3600 * 1000;

  const meetingsToday = meetings.filter((m) => {
    const t = new Date(m.scheduledAt).getTime();
    return t >= today && t < tomorrow && m.status !== "Cancelada" && m.status !== "Concluída";
  }).length;
  const awaiting = investors.filter(
    (i) => i.status === "novo" || i.status === "conversando",
  ).length;
  const lastActivity = investors
    .slice()
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())[0];

  const chips = [
    {
      icon: CalendarClock,
      label: "Reuniões hoje",
      value: meetingsToday,
      hint: meetingsToday === 0 ? "Agenda livre" : "Confirme e prepare",
    },
    {
      icon: AlertCircle,
      label: "Pendências",
      value: pendings.length,
      hint: pendings.length === 0 ? "Carteira em dia" : "Requer sua atenção",
    },
    {
      icon: Users,
      label: "Investidores aguardando",
      value: awaiting,
      hint: awaiting === 0 ? "Sem retornos pendentes" : "Retomar contato",
    },
    {
      icon: Clock,
      label: "Última atividade",
      value: lastActivity ? formatRelative(lastActivity.lastActivity) : "—",
      hint: lastActivity ? lastActivity.name : "Nenhum registro recente",
    },
  ];

  return (
    <section className="relative mb-12 overflow-hidden rounded-3xl border border-[color:var(--gold)]/25 bg-gradient-to-br from-[color:var(--card)]/70 via-[color:var(--card)]/40 to-transparent px-7 py-9 md:px-10 md:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)]">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            Sua rotina de hoje
          </p>
          <h2 className="font-display text-3xl leading-tight md:text-4xl">
            {greeting(session.name)}.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
            Este é o resumo executivo do seu dia — reuniões, pendências, investidores
            aguardando retorno e a última atividade da sua carteira.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <button
            type="button"
            onClick={onSimulate}
            className="group inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20"
          >
            <Calculator className="h-3.5 w-3.5" strokeWidth={1.75} />
            Nova simulação
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
          <Link
            to="/executivo/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[color:var(--foreground)]/80 transition hover:border-[color:var(--gold)]/40"
          >
            <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.75} />
            Abrir central
          </Link>
        </div>
      </div>

      <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {chips.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/40 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                {c.label}
              </p>
              <c.icon className="h-4 w-4 text-[color:var(--gold)]" strokeWidth={1.5} />
            </div>
            <p className="mt-2 font-display text-2xl leading-none">{c.value}</p>
            <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">{c.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-1.5">
      <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)]">
        {eyebrow}
      </p>
      <h3 className="font-display text-xl md:text-2xl">{title}</h3>
      {subtitle && (
        <p className="max-w-2xl text-sm text-[color:var(--muted-foreground)]">{subtitle}</p>
      )}
    </div>
  );
}

function TodayAgenda({ session }: { session: ExecutiveSession }) {
  const { meetings } = useExecutiveScope(session);
  const upcoming = useMemo(() => {
    const now = Date.now();
    const end = endOfToday().getTime();
    const todayList = meetings
      .filter((m) => {
        const t = new Date(m.scheduledAt).getTime();
        return t >= now - 3600 * 1000 && t <= end &&
          m.status !== "Cancelada" && m.status !== "Concluída";
      })
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
    if (todayList.length > 0) return { list: todayList, scope: "hoje" as const };
    const future = meetings
      .filter(
        (m) =>
          new Date(m.scheduledAt).getTime() > end &&
          m.status !== "Cancelada" &&
          m.status !== "Concluída",
      )
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
      .slice(0, 4);
    return { list: future, scope: "proximas" as const };
  }, [meetings]);

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[color:var(--gold)]" strokeWidth={1.5} />
          <h3 className="font-display text-base">
            {upcoming.scope === "hoje" ? "Agenda de hoje" : "Próximas reuniões"}
          </h3>
        </div>
        <Link
          to="/executivo/reunioes"
          className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--gold)]"
        >
          Central de reuniões
        </Link>
      </div>
      {upcoming.list.length === 0 ? (
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Nenhuma reunião programada. Agende um encontro a partir da ficha do investidor.
        </p>
      ) : (
        <ul className="space-y-2">
          {upcoming.list.slice(0, 5).map((m) => (
            <MeetingRow key={m.id} meeting={m} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const when = new Date(meeting.scheduledAt);
  const time = when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const day = when.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const isToday = when.toDateString() === new Date().toDateString();
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/30 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-[color:var(--foreground)]">{meeting.investorName}</p>
        <p className="text-[11px] text-[color:var(--muted-foreground)]">
          {isToday ? `Hoje · ${time}` : `${day} · ${time}`}
        </p>
      </div>
      <span
        className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]"
        style={{
          color: MEETING_STATUS_TONE[meeting.status],
          borderColor: MEETING_STATUS_TONE[meeting.status] + "55",
        }}
      >
        {meeting.status}
      </span>
    </li>
  );
}

function PortfolioSnapshot({ session }: { session: ExecutiveSession }) {
  const { investors } = useExecutiveScope(session);
  const recent = investors
    .slice()
    .sort((a, b) => +new Date(b.lastActivity) - +new Date(a.lastActivity))
    .slice(0, 5);
  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[color:var(--gold)]" strokeWidth={1.5} />
          <h3 className="font-display text-base">Sua carteira</h3>
        </div>
        <Link
          to="/executivo/investidores"
          className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--gold)]"
        >
          Ver todos ({investors.length})
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Nenhum investidor vinculado no momento.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)]/60">
          {recent.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-[color:var(--foreground)]">{i.name}</p>
                <p className="text-[11px] text-[color:var(--muted-foreground)]">
                  {STATUS_LABEL[i.status]} · {i.currentChapter} · {i.readingPct}%
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-[color:var(--muted-foreground)]">
                {formatRelative(i.lastActivity)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SimulatorAside({ onStart }: { onStart: () => void }) {
  return (
    <section className="flex flex-col justify-between rounded-2xl border border-[color:var(--gold)]/30 bg-gradient-to-br from-[color:var(--gold)]/10 via-[color:var(--card)]/50 to-transparent p-6">
      <div>
        <p className="mb-2 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[color:var(--gold)]">
          <Calculator className="h-3.5 w-3.5" strokeWidth={1.75} />
          Ferramenta consultiva
        </p>
        <h3 className="font-display text-lg leading-snug">
          Precisa preparar uma projeção para uma conversa?
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          Abra o Simulador Inteligente e monte cenários com produtos, volume e comissões
          oficiais em minutos.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/15 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/25"
      >
        Nova simulação
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </section>
  );
}

function ModuleCard({ module: mod }: { module: PlatformModule }) {
  const Icon = mod.icon;
  const isActive = mod.status === "ativo";

  const body = (
    <div
      className={
        "group flex h-full items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4 transition-all " +
        (isActive
          ? "hover:-translate-y-0.5 hover:border-[color:var(--gold)]/40 hover:bg-[color:var(--card)]/60"
          : "opacity-70")
      }
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-display text-sm">{mod.name}</p>
          {isActive ? (
            mod.external ? (
              <ExternalLink
                className="h-3.5 w-3.5 shrink-0 text-[color:var(--muted-foreground)] transition group-hover:text-[color:var(--gold)]"
                strokeWidth={1.5}
              />
            ) : (
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 text-[color:var(--muted-foreground)] transition group-hover:text-[color:var(--gold)]"
                strokeWidth={1.5}
              />
            )
          ) : (
            <span className="shrink-0 text-[9px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              Em breve
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
          {mod.description}
        </p>
      </div>
    </div>
  );

  if (isActive && mod.href) {
    const isExternal = mod.external === true;
    return (
      <a
        href={mod.href}
        className="block"
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }
  if (isActive && mod.to) {
    return (
      <Link to={mod.to} className="block">
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
}