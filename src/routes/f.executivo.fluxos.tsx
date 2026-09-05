/**
 * BLOCO 4 — CONFIGURAÇÃO DE FLUXOS (administração).
 *
 * A Biblioteca define a existência e o conteúdo das etapas. Aqui se
 * define quais participam de cada fluxo, em que ordem e com que prazo.
 * Versão publicada é imutável e vale apenas para ciclos novos.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { FlowVersionsPanel } from "@/components/executive/flow-versions-panel";

export const Route = createFileRoute("/f/executivo/fluxos")({
  head: () => ({
    meta: [
      { title: "Configuração de Fluxos — Atlas Platform" },
      {
        name: "description",
        content:
          "Defina quais etapas participam de cada fluxo do Motor de Relacionamento, em que ordem e com que prazo.",
      },
      { property: "og:title", content: "Configuração de Fluxos — Atlas Platform" },
      {
        property: "og:description",
        content: "Versões de fluxo imutáveis: alterações valem somente para ciclos novos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FluxosPage,
});

function FluxosPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureCloudSession();
      setSession(getSession());
    })();
  }, []);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Configuração de Fluxos">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-[color:var(--gold)]" />
          <div>
            <h1 className="text-lg font-medium">Configuração de Fluxos</h1>
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Cada versão publicada é congelada. Quem já está em andamento continua no
              fluxo que existia quando entrou; a nova versão vale só para quem entrar depois.
            </p>
          </div>
        </header>

        <FlowVersionsPanel />
      </div>
    </ExecutiveShell>
  );
}
