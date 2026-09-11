/**
 * CENTRAL DE HOMOLOGAÇÃO → VALIDAÇÃO TEMPORAL CONTROLADA.
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { HomologationTabs } from "@/components/executive/homologation-tabs";
import { HomologationDailyActionsDemo } from "@/components/executive/homologation-daily-actions-demo";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";

export const Route = createFileRoute("/f/executivo/homologacao/acao-do-dia")({
  head: () => ({
    meta: [
      { title: "Ação do Dia — Teste Controlado | Velox" },
      {
        name: "description",
        content:
          "Validação temporal isolada da Ação do Dia com quatro leads selecionados e relógio lógico acelerado.",
      },
      { property: "og:title", content: "Ação do Dia — Teste Controlado | Velox" },
      {
        property: "og:description",
        content: "Validação temporal isolada, sem alterar a fila produtiva ou enviar mensagens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: DemoTab,
});

function DemoTab() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Homologação">
      <div className="space-y-6">
        <HomologationTabs />
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
          <h1 className="text-lg text-[color:var(--foreground)]">Ação do Dia — Teste controlado</h1>
          <div className="mt-4">
            <HomologationDailyActionsDemo />
          </div>
        </div>
      </div>
    </ExecutiveShell>
  );
}
