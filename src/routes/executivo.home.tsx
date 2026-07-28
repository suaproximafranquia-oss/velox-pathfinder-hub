import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ExternalLink,
  BookOpen,
  Compass,
  Calculator,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, ROLE_LABEL, type ExecutiveSession } from "@/lib/executive-auth";
import { PLATFORM_MODULES, type PlatformModule } from "@/config/modules";
import { WORKSPACE } from "@/config/workspace";
import { PendingsCard } from "@/components/executive/pendings-card";
import { SimulatorModal } from "@/components/simulator/simulator-modal";
import { derivePendings } from "@/lib/pendings";

export const Route = createFileRoute("/executivo/home")({
  head: () => ({
    meta: [
      { title: "Portal Velox — Assistente Executivo" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomePage,
});

type JourneyStep = {
  index: number;
  id: string;
  label: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
  cta: string;
  action:
    | { kind: "external"; href: string }
    | { kind: "internal"; to: string }
    | { kind: "simulator" };
  featured?: boolean;
};

const JOURNEY: JourneyStep[] = [
  {
    index: 1,
    id: "manual",
    label: "Educação",
    title: "Manual do Investidor",
    description:
      "Recepcione o investidor com conteúdo consultivo, transparente e sem pressão comercial.",
    icon: BookOpen,
    cta: "Abrir manual",
    action: { kind: "external", href: "/manual" },
  },
  {
    index: 2,
    id: "universo",
    label: "Autoridade",
    title: "Material Institucional",
    description:
      "Apresente o ecossistema Velox — história, modelo, produtos e cobertura nacional.",
    icon: Compass,
    cta: "Apresentar Velox",
    action: { kind: "external", href: "/universo" },
  },
  {
    index: 3,
    id: "simulador",
    label: "Valor",
    title: "Simulador Inteligente",
    description:
      "Traduza a conversa em números. Projete receita mensal e anual com base em cenários reais.",
    icon: Calculator,
    cta: "Iniciar simulação",
    action: { kind: "simulator" },
    featured: true,
  },
  {
    index: 4,
    id: "central",
    label: "Operação",
    title: "Central do Executivo",
    description:
      "Acompanhe pendências, agenda, indicadores e o histórico completo da sua carteira.",
    icon: LayoutDashboard,
    cta: "Abrir central",
    action: { kind: "internal", to: "/executivo/dashboard" },
  },
];

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

  const journeyIds = new Set(["manual", "universo"]);
  const visibleModules = PLATFORM_MODULES.filter(
    (m) =>
      (!m.requiresRole || m.requiresRole.includes(session.activeRole)) &&
      !journeyIds.has(m.id),
  );

  return (
    <ExecutiveShell session={session} title={`Bem-vindo, ${session.name.split(" ")[0]}`}>
      <GreetingHero session={session} onSimulate={() => setSimulatorOpen(true)} />

      <section className="mb-12">
        <SectionHeader
          eyebrow="Jornada principal"
          title="Conduza o investidor em quatro passos"
          subtitle="Educação, autoridade, valor e operação — na sequência natural de uma conversa consultiva."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {JOURNEY.map((step, i) => (
            <JourneyCard
              key={step.id}
              step={step}
              isLast={i === JOURNEY.length - 1}
              onSimulate={() => setSimulatorOpen(true)}
            />
          ))}
        </div>
      </section>

      <section className="mb-12">
        <SimulatorSpotlight onStart={() => setSimulatorOpen(true)} />
      </section>

      <section className="mb-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <NextStepCard session={session} onSimulate={() => setSimulatorOpen(true)} />
        <PendingsCard executiveId={session.userId} />
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

function GreetingHero({
  session,
  onSimulate,
}: {
  session: ExecutiveSession;
  onSimulate: () => void;
}) {
  const pendingCount = useMemo(
    () => derivePendings({ executiveId: session.userId }).length,
    [session.userId],
  );
  return (
    <section className="relative mb-12 overflow-hidden rounded-3xl border border-[color:var(--gold)]/25 bg-gradient-to-br from-[color:var(--card)]/70 via-[color:var(--card)]/40 to-transparent px-7 py-9 md:px-10 md:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)]">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            Assistente executivo Velox
          </p>
          <h2 className="font-display text-3xl leading-tight md:text-4xl">
            {greeting(session.name)}.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
            Sua jornada consultiva começa aqui. Prepare o investidor, apresente o ecossistema
            e transforme a conversa em uma projeção clara de receita.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <button
            type="button"
            onClick={onSimulate}
            className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-5 py-3 text-sm font-medium text-[color:var(--background)] shadow-lg shadow-[color:var(--gold)]/20 transition hover:brightness-110"
          >
            <Calculator className="h-4 w-4" strokeWidth={1.75} />
            Iniciar nova simulação
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            {pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? "pendência" : "pendências"} · sua atenção`
              : "Carteira em dia"}
          </p>
        </div>
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

function JourneyCard({
  step,
  isLast,
  onSimulate,
}: {
  step: JourneyStep;
  isLast: boolean;
  onSimulate: () => void;
}) {
  const Icon = step.icon;
  const num = String(step.index).padStart(2, "0");

  const inner = (
    <div
      className={
        "group relative flex h-full flex-col rounded-2xl border p-5 transition-all duration-300 " +
        (step.featured
          ? "border-[color:var(--gold)]/60 bg-gradient-to-br from-[color:var(--gold)]/10 via-[color:var(--card)]/50 to-transparent shadow-lg shadow-[color:var(--gold)]/10 hover:-translate-y-0.5 hover:border-[color:var(--gold)]"
          : "border-[color:var(--border)] bg-[color:var(--card)]/40 hover:-translate-y-0.5 hover:border-[color:var(--gold)]/40 hover:bg-[color:var(--card)]/60")
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <span
          className={
            "font-display text-2xl " +
            (step.featured ? "text-[color:var(--gold)]" : "text-[color:var(--muted-foreground)]/50")
          }
        >
          {num}
        </span>
        <span
          className={
            "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition " +
            (step.featured
              ? "border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
              : "border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]")
          }
        >
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </span>
      </div>
      <p className="mb-1 text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
        {step.label}
      </p>
      <p className="font-display text-base leading-snug">{step.title}</p>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
        {step.description}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border)]/60 pt-3">
        <span
          className={
            "text-[11px] uppercase tracking-[0.22em] " +
            (step.featured ? "text-[color:var(--gold)]" : "text-[color:var(--foreground)]/80")
          }
        >
          {step.cta}
        </span>
        <ArrowUpRight
          className={
            "h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 " +
            (step.featured ? "text-[color:var(--gold)]" : "text-[color:var(--muted-foreground)]")
          }
          strokeWidth={1.5}
        />
      </div>
      {!isLast && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-[color:var(--gold)]/30 xl:block"
        />
      )}
    </div>
  );

  if (step.action.kind === "simulator") {
    return (
      <button type="button" onClick={onSimulate} className="block h-full w-full text-left">
        {inner}
      </button>
    );
  }
  if (step.action.kind === "internal") {
    return (
      <Link to={step.action.to} className="block h-full">
        {inner}
      </Link>
    );
  }
  return (
    <a
      href={step.action.href}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full"
    >
      {inner}
    </a>
  );
}

function SimulatorSpotlight({ onStart }: { onStart: () => void }) {
  const highlights = [
    "Cenários financeiros com base em produtos reais",
    "Projeção de receita mensal e anual",
    "Relatório executivo pronto para a conversa",
  ];
  return (
    <button
      type="button"
      onClick={onStart}
      className="group relative block w-full overflow-hidden rounded-3xl border border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--gold)]/15 via-[color:var(--card)]/60 to-[color:var(--background)]/20 p-8 text-left transition hover:border-[color:var(--gold)] md:p-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)]">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            Diferencial competitivo
          </p>
          <h3 className="font-display text-2xl leading-tight md:text-3xl">
            Transforme cada conversa em uma projeção de receita concreta.
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
            O Simulador Inteligente combina produtos, volume e comissões oficiais para
            entregar, em minutos, um relatório executivo que sustenta a decisão do investidor.
          </p>
          <ul className="mt-5 space-y-2">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-[color:var(--foreground)]/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" strokeWidth={2} />
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-5 py-3 text-sm font-medium text-[color:var(--background)] shadow-lg shadow-[color:var(--gold)]/20 transition group-hover:brightness-110">
            <Calculator className="h-4 w-4" strokeWidth={1.75} />
            Iniciar simulação agora
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Leva menos de 3 minutos
          </p>
        </div>
      </div>
    </button>
  );
}

function NextStepCard({
  session,
  onSimulate,
}: {
  session: ExecutiveSession;
  onSimulate: () => void;
}) {
  const pendings = useMemo(
    () => derivePendings({ executiveId: session.userId }),
    [session.userId],
  );
  const hasPending = pendings.length > 0;
  return (
    <section className="flex flex-col justify-between rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)]">
          Próximo passo
        </p>
        <h3 className="font-display text-xl leading-snug">
          {hasPending
            ? "Resolva o que exige sua atenção antes de avançar."
            : "Sua carteira está em dia — hora de gerar valor."}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          {hasPending
            ? "Priorize as pendências ao lado e volte à jornada consultiva."
            : "Convide um investidor para uma simulação e transforme a conversa em uma projeção clara de receita."}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSimulate}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20"
        >
          <Calculator className="h-3.5 w-3.5" strokeWidth={1.75} /> Nova simulação
        </button>
        <Link
          to="/executivo/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[color:var(--foreground)]/80 transition hover:border-[color:var(--gold)]/40"
        >
          <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.75} /> Abrir central
        </Link>
      </div>
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