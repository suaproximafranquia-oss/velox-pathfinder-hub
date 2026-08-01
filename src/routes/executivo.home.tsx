import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  ROLE_LABEL,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { PLATFORM_MODULES, type PlatformModule } from "@/config/modules";
import { getCorporateDriveLink } from "@/lib/google-drive.functions";
import { WORKSPACE } from "@/config/workspace";

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
      <WorkspaceHero session={session} />

      <section className="mt-10">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-2xl md:text-3xl">Módulos</h2>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
            {visibleModules.length} disponíveis
          </p>
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

function WorkspaceHero({ session }: { session: ExecutiveSession }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-[color:var(--gold)]/25 bg-gradient-to-br from-[color:var(--card)]/70 via-[color:var(--card)]/40 to-transparent px-8 py-10 md:px-12 md:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 70%)" }}
      />
      <div className="relative max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--gold)]">
          Corporate Workspace
        </p>
        <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
          {WORKSPACE.workspaceName}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
          Ambiente corporativo unificado para operação, educação e relacionamento. Você está
          autenticado como <strong className="text-[color:var(--foreground)]">{ROLE_LABEL[session.activeRole]}</strong>.
        </p>
        <p className="mt-6 text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]/80">
          {WORKSPACE.poweredBy}
        </p>
      </div>
    </section>
  );
}

function ModuleCard({ module: mod }: { module: PlatformModule }) {
  return <ModuleCardBody module={mod} />;
}

/**
 * Drive Corporativo — abre sempre a pasta oficial da Conta Google do
 * Portal, nunca o Drive da conta logada no navegador.
 */
function CorporateDriveCard({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function open() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const tab = window.open("", "_blank", "noopener,noreferrer");
    try {
      const { url } = await getCorporateDriveLink({ data: {} });
      if (url) {
        if (tab) tab.location.href = url;
        else window.open(url, "_blank", "noopener,noreferrer");
      } else {
        tab?.close();
        setMessage("Conecte a Conta Google do Portal para abrir o Drive corporativo.");
      }
    } catch {
      tab?.close();
      setMessage("Não foi possível abrir o Drive corporativo agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void open()} className="block w-full text-left">
        {children}
      </button>
      {message ? (
        <p className="mt-2 text-[11px] text-amber-400">{message}</p>
      ) : null}
    </div>
  );
}

function ModuleCardBody({ module: mod }: { module: PlatformModule }) {
  const Icon = mod.icon;
  const isActive = mod.status === "ativo";

  const body = (
    <div
      className={
        "group flex h-full flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 transition-all " +
        (isActive
          ? "hover:-translate-y-0.5 hover:border-[color:var(--gold)]/50 hover:bg-[color:var(--card)]/60"
          : "opacity-70")
      }
    >
      <div className="flex items-start justify-between">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/50 text-[color:var(--gold)]">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </span>
        {isActive ? (
          mod.external ? (
            <ExternalLink
              className="h-4 w-4 text-[color:var(--muted-foreground)] transition group-hover:text-[color:var(--gold)]"
              strokeWidth={1.5}
            />
          ) : (
            <ArrowUpRight
              className="h-4 w-4 text-[color:var(--muted-foreground)] transition group-hover:text-[color:var(--gold)]"
              strokeWidth={1.5}
            />
          )
        ) : (
          <span className="text-[9px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Em desenvolvimento
          </span>
        )}
      </div>
      <div>
        <p className="font-display text-lg leading-tight">{mod.name}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--muted-foreground)]">
          {mod.description}
        </p>
      </div>
    </div>
  );

  if (isActive && mod.href) {
    const isExternal = mod.external === true;
    if (mod.id === "drive") return <CorporateDriveCard>{body}</CorporateDriveCard>;
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