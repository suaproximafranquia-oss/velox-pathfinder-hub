import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, LayoutDashboard, Users, UserCog, LogOut, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import {
  getSession,
  signOut,
  canManageUsers,
  ROLE_LABEL,
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
    { to: "/executivo/investidores", label: "Investidores", icon: Users },
    ...(canManageUsers(session.role)
      ? [{ to: "/executivo/usuarios", label: "Usuários", icon: UserCog }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] bg-grain">
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
            <span className="hidden md:inline text-xs text-[color:var(--muted-foreground)]">
              {session.name} · {ROLE_LABEL[session.role]}
            </span>
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

      <div className="mx-auto max-w-6xl px-6 pt-24 md:pt-28 pb-16 grid gap-8 md:grid-cols-[220px_1fr]">
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
        <main>
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