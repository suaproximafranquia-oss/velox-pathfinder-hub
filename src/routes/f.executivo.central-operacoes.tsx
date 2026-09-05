/**
 * CENTRAL DE OPERAÇÕES (/f) — leitura gerencial consolidada.
 *
 * Rota somente leitura: nenhuma ação é criada, executada, concluída,
 * pulada ou reagendada aqui. A permissão real é validada no servidor
 * (administração/gestão); a tela apenas apresenta o resultado.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { CentralOperacoesHome } from "@/components/executive/central-operacoes/central-home";

export const Route = createFileRoute("/f/executivo/central-operacoes")({
  head: () => ({
    meta: [
      { title: "Central de Operações — Atlas Platform" },
      {
        name: "description",
        content:
          "Visão gerencial consolidada das ações planejadas, executadas, pendentes e puladas da Financeira.",
      },
      { property: "og:title", content: "Central de Operações — Atlas Platform" },
      {
        property: "og:description",
        content: "Leitura consolidada da operação por executivo, tipo de ação e período.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CentralOperacoesPage,
});

function CentralOperacoesPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureCloudSession();
      setSession(getSession());
    })();
  }, []);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Operações">
      <CentralOperacoesHome />
    </ExecutiveShell>
  );
}
