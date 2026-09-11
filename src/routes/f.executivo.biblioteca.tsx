/**
 * BIBLIOTECA DE MENSAGENS.
 *
 * A mensagem é autossuficiente: o corpo publicado contém todo o texto,
 * inclusive links escritos pela Gestão. Nada nesta tela dispara mensagem.
 */
import { WorkspaceResourceGuard } from "@/components/executive/workspace-resource-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LibraryBig } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { MessageLibraryPanel } from "@/components/executive/message-library-panel";

export const Route = createFileRoute("/f/executivo/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca de Mensagens — Atlas Platform" },
      {
        name: "description",
        content:
          "Texto oficial de cada etapa do Motor de Relacionamento, publicado e versionado pela Gestão.",
      },
      { property: "og:title", content: "Biblioteca de Mensagens — Atlas Platform" },
      {
        property: "og:description",
        content: "Cada etapa tem uma mensagem oficial autossuficiente e versionada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  /** Autorização única do Corporate Workspace (servidor decide). */
  component: () => (
    <WorkspaceResourceGuard resource="biblioteca">
      <BibliotecaPage />
    </WorkspaceResourceGuard>
  ),
});

function BibliotecaPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureCloudSession();
      setSession(getSession());
    })();
  }, []);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Biblioteca de Mensagens">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="flex items-center gap-2">
          <LibraryBig className="h-5 w-5 text-[color:var(--gold)]" />
          <div>
            <h1 className="text-lg font-medium">Biblioteca de Mensagens</h1>
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Cada etapa tem uma mensagem completa. Publicar cria a versão seguinte; o
              histórico enviado nunca é reescrito.
            </p>
          </div>
        </header>

        <MessageLibraryPanel />
      </div>
    </ExecutiveShell>
  );
}
