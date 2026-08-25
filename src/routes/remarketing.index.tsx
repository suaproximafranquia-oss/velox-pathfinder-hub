import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Megaphone } from "lucide-react";
import {
  getSession,
  signOut,
  ROLE_LABEL,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { WORKSPACE } from "@/config/workspace";

/**
 * Ambiente de Remarketing — módulo independente.
 *
 * Abre exclusivamente em nova aba do navegador (item "Remarketing" do
 * menu lateral usa `target="_blank"`, o mesmo comportamento do CRM).
 * Não é modal, drawer, painel sobreposto nem subárea visual do
 * Workspace: possui rota/URL própria e renderiza em tela cheia.
 */
export const Route = createFileRoute("/remarketing/")({
  head: () => ({
    meta: [
      { title: `Remarketing — ${WORKSPACE.workspaceName}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RemarketingPage,
});

function RemarketingPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] bg-grain">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--navy-deep)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
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
                Remarketing
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                {WORKSPACE.workspaceName} · ambiente independente
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[color:var(--muted-foreground)] sm:inline">
              {session.name} · {ROLE_LABEL[session.activeRole]}
            </span>
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

      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-28">
        <div className="mb-8 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/50 text-[color:var(--gold)]">
            <Megaphone className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Ambiente de Remarketing</h1>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              CRM operacional independente — isolado do CRM de Relacionamento.
            </p>
          </div>
        </div>

        <RemarketingWorkspace operatorName={session.name} />
      </main>

    </div>
  );
}
