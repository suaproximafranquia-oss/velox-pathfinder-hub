/**
 * BIBLIOTECA DE MENSAGENS.
 *
 * NOVO MODELO: a mensagem é autossuficiente. O texto oficial e o link do
 * conteúdo pertencem à MESMA versão publicada. O cadastro separado de
 * "conteúdo" deixou de existir — não há mais vínculo etapa ↔ conteúdo,
 * pool nem rotação. Nada nesta tela dispara mensagem.
 */
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
          "Texto oficial e link de cada etapa do Motor de Relacionamento, versionados na mesma mensagem.",
      },
      { property: "og:title", content: "Biblioteca de Mensagens — Atlas Platform" },
      {
        property: "og:description",
        content: "Cada etapa tem uma mensagem autossuficiente: texto e link publicados juntos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BibliotecaPage,
});

function BibliotecaPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureCloudSession();
      setSession(getSession());
    })();
  }, []);

  return (
    <ExecutiveShell session={session}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header className="flex items-center gap-2">
          <LibraryBig className="h-5 w-5 text-[color:var(--gold)]" />
          <div>
            <h1 className="text-lg font-medium">Biblioteca de Mensagens</h1>
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Cada etapa tem uma mensagem: texto e link na mesma versão. Publicar cria a
              versão seguinte; o histórico enviado nunca é reescrito.
            </p>
          </div>
        </header>

        <MessageLibraryPanel />
      </div>
    </ExecutiveShell>
  );
}
