/**
 * AÇÃO DO DIA — MODO DEMONSTRAÇÃO.
 *
 * Mesma interface do modo real, com dados fictícios em memória. Esta
 * rota NÃO alcança servidor, banco, E0, cadência, timeline nem
 * WhatsApp: o adaptador de demonstração não importa nenhuma função de
 * servidor. Nada aqui cria ou altera qualquer registro.
 *
 * Acesso: exatamente o mesmo do modo real (guard operacional +
 * permissão do módulo Portal de Leads). Nenhuma regra nova.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DailyActionsOverlay } from "@/components/crm/daily-actions-overlay";
import { OperationalGuard } from "@/components/auth/operational-guard";
import { ModuleAccessDenied } from "@/components/executive/module-access-guard";
import { useModuleAccess } from "@/hooks/use-workspace-permissions";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { createDemoDailyActionsAdapter } from "@/lib/crm/daily-actions.demo";

export const Route = createFileRoute("/f/executivo/acao-do-dia-demo")({
  head: () => ({
    meta: [
      { title: "Ação do Dia — Demonstração | Velox" },
      {
        name: "description",
        content:
          "Ambiente de demonstração da Ação do Dia do Workspace Velox, com dados fictícios e execução simulada.",
      },
      { property: "og:title", content: "Ação do Dia — Demonstração | Velox" },
      {
        property: "og:description",
        content: "Demonstração da fila operacional da Ação do Dia, sem qualquer efeito real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: () => (
    <OperationalGuard>
      <DailyActionsDemoPage />
    </OperationalGuard>
  ),
});

function DailyActionsDemoPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [open, setOpen] = useState(true);
  const adapter = useMemo(() => createDemoDailyActionsAdapter(), []);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const portalAllowed = useModuleAccess(
    session?.userId ?? "",
    session?.activeRole ?? "executivo",
    "portal_leads",
  );

  if (!session) return null;
  if (!portalAllowed) return <ModuleAccessDenied moduleKey="portal_leads" />;

  return (
    <main className="min-h-screen bg-[color:var(--navy-deep)] px-5 py-10 text-white/80">
      <div className="mx-auto max-w-3xl space-y-4">
        <span className="inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
          Demonstração
        </span>
        <h1 className="font-display text-2xl text-white">Ação do Dia — Demonstração</h1>
        <p className="text-sm text-white/55">
          Fila fictícia com 36 ações e execução simulada. Executar uma ação apenas a envia para o
          final da fila: nenhum lead, card, primeiro contato, mensagem ou histórico é criado ou
          alterado. Recarregar a página reinicia a demonstração.
        </p>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20"
          >
            Abrir a Ação do Dia
          </button>
        )}
      </div>

      <DailyActionsOverlay
        adapter={adapter}
        open={open}
        onClose={() => setOpen(false)}
        /* Demonstração nunca abre a ficha real de um investidor. */
        onOpenLead={() => {}}
      />
    </main>
  );
}
