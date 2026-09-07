/**
 * CENTRAL DOS NOMES (/f) — dicionário manual do Administrador.
 *
 * A tela apenas cola, lista e exclui. Nenhuma decisão de cadência,
 * etapa ou envio acontece aqui, e nenhum nome de lead é alterado.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WorkspaceResourceGuard } from "@/components/executive/workspace-resource-guard";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { NameCentralPanel } from "@/components/executive/name-central-panel";

export const Route = createFileRoute("/f/executivo/central-nomes")({
  head: () => ({
    meta: [
      { title: "Central dos Nomes — Atlas Platform" },
      {
        name: "description",
        content:
          "Dicionário manual de primeiros nomes usado como camada auxiliar de interpretação do Motor de Relacionamento.",
      },
      { property: "og:title", content: "Central dos Nomes — Atlas Platform" },
      {
        property: "og:description",
        content: "Primeiros nomes cadastrados manualmente pelo Administrador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <WorkspaceResourceGuard resource="central_nomes">
      <CentralNomesPage />
    </WorkspaceResourceGuard>
  ),
});

function CentralNomesPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureCloudSession();
      setSession(getSession());
    })();
  }, []);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central dos Nomes">
      <NameCentralPanel />
    </ExecutiveShell>
  );
}
