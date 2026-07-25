import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, ROLE_LABEL, type ExecutiveSession } from "@/lib/executive-auth";
import { PLATFORM_MODULES, type PlatformModule } from "@/config/modules";
import { WORKSPACE } from "@/config/workspace";

export const Route = createFileRoute("/executivo/home")({
  head: () => ({
    meta: [
      { title: "Atlas Platform — Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);

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
      <section className="mb-10 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-6 py-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)] mb-2">
          {WORKSPACE.platformName}
        </p>
        <h2 className="font-display text-xl md:text-2xl mb-2">
          {WORKSPACE.platformTagline}
        </h2>
        <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed max-w-2xl">
          Ambiente corporativo unificado para operação, educação e relacionamento.
          Selecione um módulo abaixo para continuar. Você está autenticado como{" "}
          <span className="text-[color:var(--foreground)]">
            {ROLE_LABEL[session.activeRole]}
          </span>
          .
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h3 className="font-display text-lg">Módulos</h3>
          <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            {visibleModules.length} disponíveis
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
        </div>
      </section>
    </ExecutiveShell>
  );
}

function ModuleCard({ module: mod }: { module: PlatformModule }) {
  const Icon = mod.icon;
  const isActive = mod.status === "ativo";

  const body = (
    <div
      className={
        "group h-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5 transition-colors " +
        (isActive
          ? "hover:border-[color:var(--gold)]/40 hover:bg-[color:var(--card)]/60"
          : "opacity-70")
      }
    >
      <div className="flex items-start justify-between mb-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </span>
        {isActive ? (
          <ArrowUpRight
            className="h-4 w-4 text-[color:var(--muted-foreground)] group-hover:text-[color:var(--gold)] transition"
            strokeWidth={1.5}
          />
        ) : (
          <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Em breve
          </span>
        )}
      </div>
      <p className="font-display text-base mb-1.5">{mod.name}</p>
      <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
        {mod.description}
      </p>
    </div>
  );

  if (isActive && mod.href) {
    return (
      <a href={mod.href} className="block">
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