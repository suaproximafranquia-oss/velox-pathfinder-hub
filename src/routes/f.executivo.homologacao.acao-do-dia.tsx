/**
 * CENTRAL DE HOMOLOGAÇÃO → AÇÃO DO DIA (DEMONSTRAÇÃO).
 *
 * Reaproveita integralmente o overlay real e o adaptador de
 * demonstração já existentes. Nenhuma função de produção é chamada.
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
      { title: "Ação do Dia — Demonstração | Central de Homologação" },
      {
        name: "description",
        content:
          "Demonstração isolada da Ação do Dia do Workspace Velox, com dados fictícios e execução simulada.",
      },
      { property: "og:title", content: "Ação do Dia — Demonstração | Central de Homologação" },
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
          <h1 className="text-lg text-[color:var(--foreground)]">Ação do Dia — Demonstração</h1>
          <div className="mt-4">
            <HomologationDailyActionsDemo />
          </div>
        </div>
      </div>
    </ExecutiveShell>
  );
}
