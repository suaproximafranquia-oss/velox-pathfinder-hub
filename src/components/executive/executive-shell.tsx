import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  LayoutDashboard,
  Users,
  UserCog,
  LogOut,
  ArrowLeft,
  Database,
  Sparkles,
  Brain,
  Gauge,
  FileBarChart2,
  ChevronDown,
  Check,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getSession,
  signOut,
  canManageUsers,
  canManageKnowledge,
  availableRoles,
  setActiveRole,
  ROLE_LABEL,
  type ExecutiveRole,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { WORKSPACE } from "@/config/workspace";
import { cn } from "@/lib/utils";

export function ExecutiveShell({
  session,
  children,
  title,
}: {
  session: ExecutiveSession;
  children: ReactNode;
  title: string;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/executivo/home", label: "Home", icon: LayoutGrid },
    { to: "/executivo/dashboard", label: "Painel", icon: LayoutDashboard },
    { to: "/executivo/brain", label: "Brain Analytics", icon: Brain },
    { to: "/executivo/kpi", label: "KPI Manager", icon: Gauge },
    { to: "/executivo/relatorios", label: "Relatórios", icon: FileBarChart2 },
    { to: "/executivo/investidores", label: "Investidores", icon: Users },
    { to: "/executivo/ia", label: "IA Corporativa", icon: Sparkles },
    ...(canManageKnowledge(session.activeRole)
      ? [{ to: "/executivo/conhecimento", label: "Conhecimento", icon: Database }]
      : []),
    ...(canManageUsers(session.activeRole)
      ? [{ to: "/executivo/usuarios", label: "Usuários", icon: UserCog }]
      : []),
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[color:var(--background)] text-[color:var(--foreground)] bg-grain">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--navy-deep)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 gap-4">
          <div className="flex items-center gap-3">
            {WORKSPACE.workspaceLogoUrl ? (
              <img
                src={WORKSPACE.workspaceLogoUrl}
                alt={WORKSPACE.workspaceName}
                className="h-7 w-auto object-contain"
              />
            ) : null}
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm tracking-[0.18em] text-[color:var(--foreground)]">
                {WORKSPACE.workspaceName}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                {WORKSPACE.workspaceTagline}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ProfileSwitcher session={session} />
            <Link
              to="/"
              title="Retornando ao Manual do Investidor"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Manual
            </Link>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate({ to: "/executivo" });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pt-24 md:pt-28 pb-16 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="md:sticky md:top-28 h-fit">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {nav.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm border transition-colors whitespace-nowrap",
                    active
                      ? "border-[color:var(--gold)]/30 bg-[color:var(--accent)] text-[color:var(--foreground)]"
                      : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)]/60",
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">
          <h1 className="font-display text-2xl md:text-3xl mb-8">{title}</h1>
          {children}
        </main>
      </div>

      <footer className="border-t border-[color:var(--border)] bg-[color:var(--navy-deep)]/60">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          <span>{WORKSPACE.workspaceName} · {WORKSPACE.workspaceTagline}</span>
          <span>{WORKSPACE.poweredBy}</span>
        </div>
      </footer>
    </div>
  );
}

export function useRequireSession(): ExecutiveSession | null {
  if (typeof window === "undefined") return null;
  return getSession();
}

function ProfileSwitcher({ session }: { session: ExecutiveSession }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const roles = availableRoles(session.role);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(r: ExecutiveRole) {
    setActiveRole(session, r);
    setOpen(false);
    // Recarrega a interface para refletir permissões e navegação.
    if (typeof window !== "undefined") window.location.reload();
  }

  const canSwitch = roles.length > 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => canSwitch && setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
          canSwitch
            ? "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40"
            : "border-transparent text-[color:var(--muted-foreground)] cursor-default",
        )}
        title={canSwitch ? "Alternar perfil ativo" : "Perfil ativo"}
      >
        <span className="hidden sm:inline">{session.name.split(" ")[0]}</span>
        <span className="rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--gold)]">
          {ROLE_LABEL[session.activeRole]}
        </span>
        {canSwitch && <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {canSwitch && open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[color:var(--border)] bg-[color:var(--navy)] shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-[color:var(--border)]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              Perfil ativo
            </p>
            <p className="text-xs text-[color:var(--foreground)] mt-0.5">
              {session.name}
            </p>
          </div>
          <div className="py-1">
            {roles.map((r) => {
              const active = r === session.activeRole;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => choose(r)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm text-left transition",
                    active
                      ? "bg-[color:var(--accent)] text-[color:var(--foreground)]"
                      : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/60 hover:text-[color:var(--foreground)]",
                  )}
                >
                  <span>{ROLE_LABEL[r]}</span>
                  {active && <Check className="h-3.5 w-3.5 text-[color:var(--gold)]" />}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-[color:var(--border)] text-[10px] text-[color:var(--muted-foreground)] leading-relaxed">
            A alternância é aplicada imediatamente a toda a plataforma.
          </div>
        </div>
      )}
    </div>
  );
}