/**
 * ADMINISTRAÇÃO DO ROTEIRO DA APRESENTAÇÃO DIGITAL (E6 / E20).
 *
 * A área existe para CADASTRAR os vídeos que compõem a apresentação —
 * não para disparar apresentações. A geração continua exclusiva da
 * ficha do investidor no Workspace.
 *
 * Editar nunca apaga: publica uma nova versão. As apresentações já
 * emitidas seguem exibindo o roteiro congelado na emissão.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Film, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  listarCapitulos,
  permissaoApresentacao,
  salvarCapitulo,
  alternarCapitulo,
  reordenarCapitulos,
} from "@/lib/relationship/presentation.functions";

export const Route = createFileRoute("/f/executivo/apresentacao-digital")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Apresentação Digital — Atlas Platform" },
      {
        name: "description",
        content:
          "Cadastro e versionamento dos capítulos em vídeo da Apresentação Digital enviada ao investidor.",
      },
      { property: "og:title", content: "Apresentação Digital — Atlas Platform" },
      {
        property: "og:description",
        content: "Roteiro versionado dos vídeos da Apresentação Digital.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApresentacaoDigitalPage,
});

type Chapter = {
  id: string;
  chapterKey: string;
  version: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
};

const EMPTY_DRAFT = {
  chapterKey: null as string | null,
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  isActive: true,
};

function ApresentacaoDigitalPage() {
  const readPermission = useServerFn(permissaoApresentacao);
  const list = useServerFn(listarCapitulos);
  const save = useServerFn(salvarCapitulo);
  const toggle = useServerFn(alternarCapitulo);
  const reorder = useServerFn(reordenarCapitulos);

  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const permission = await readPermission({});
      setAllowed(permission.allowed);
      if (!permission.allowed) return;
      setChapters((await list({})) as Chapter[]);
    } catch (error) {
      setAllowed(false);
      toast.error(error instanceof Error ? error.message : "Falha ao carregar o roteiro.");
    }
  }, [readPermission, list]);

  useEffect(() => {
    setSession(getSession());
    void load();
  }, [load]);

  async function submit() {
    if (!draft.title.trim()) {
      toast.error("Informe o título do capítulo.");
      return;
    }
    setWorking(true);
    try {
      const result = (await save({
        data: {
          chapterKey: draft.chapterKey,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          videoUrl: draft.videoUrl.trim() || null,
          thumbnailUrl: draft.thumbnailUrl.trim() || null,
          sortOrder: chapters.length,
          isActive: draft.isActive,
        },
      })) as Chapter[];
      setChapters(result);
      setDraft({ ...EMPTY_DRAFT });
      toast.success("Nova versão publicada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setWorking(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...chapters];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    setChapters(next);
    const result = (await reorder({ data: { order: next.map((c) => c.chapterKey) } })) as Chapter[];
    setChapters(result);
  }

  if (!session || allowed === null) {
    return (
      <ExecutiveShell session={session!} title="Apresentação Digital">
        <p className="text-sm text-[color:var(--muted-foreground)]">Verificando permissão…</p>
      </ExecutiveShell>
    );
  }

  if (!allowed) {
    return (
      <ExecutiveShell session={session!} title="Apresentação Digital">
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="text-sm font-semibold">Área restrita</h2>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            O cadastro dos vídeos da Apresentação Digital depende de permissão administrativa. Ele
            não é liberado pelo cargo operacional.
          </p>
        </div>
      </ExecutiveShell>
    );
  }

  return (
    <ExecutiveShell session={session!} title="Apresentação Digital">
      <div className="space-y-6">
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Film className="h-4 w-4" aria-hidden />
            Roteiro vigente
          </h2>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            Este é o roteiro que uma NOVA apresentação congelaria. Apresentações já emitidas não
            mudam.
          </p>

          {chapters.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">
              Nenhum capítulo cadastrado. Enquanto o roteiro estiver vazio, a apresentação é gerada
              sem vídeos — nada é inventado.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {chapters.map((chapter, index) => (
                <li
                  key={chapter.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2"
                >
                  <span className="text-xs text-[color:var(--muted-foreground)]">{index + 1}.</span>
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm text-[color:var(--foreground)]">{chapter.title}</p>
                    <p className="text-[11px] text-[color:var(--muted-foreground)]">
                      versão {chapter.version} · {chapter.videoUrl ? "vídeo definido" : "sem vídeo"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void move(index, -1)}
                    className="rounded border border-[color:var(--border)] p-1"
                    aria-label="Subir"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => void move(index, 1)}
                    className="rounded border border-[color:var(--border)] p-1"
                    aria-label="Descer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const result = (await toggle({
                        data: { chapterKey: chapter.chapterKey, active: !chapter.isActive },
                      })) as Chapter[];
                      setChapters(result);
                    }}
                    className="rounded border border-[color:var(--border)] px-2 py-1 text-[11px] uppercase tracking-[0.14em]"
                  >
                    {chapter.isActive ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        chapterKey: chapter.chapterKey,
                        title: chapter.title,
                        description: chapter.description ?? "",
                        videoUrl: chapter.videoUrl ?? "",
                        thumbnailUrl: chapter.thumbnailUrl ?? "",
                        isActive: chapter.isActive,
                      })
                    }
                    className="rounded border border-[color:var(--border)] px-2 py-1 text-[11px] uppercase tracking-[0.14em]"
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {draft.chapterKey ? <Save className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {draft.chapterKey ? "Publicar nova versão do capítulo" : "Novo capítulo"}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Título
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              />
            </label>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              URL do vídeo
              <input
                value={draft.videoUrl}
                onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              />
            </label>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Imagem de capa (opcional)
              <input
                value={draft.thumbnailUrl}
                onChange={(e) => setDraft({ ...draft, thumbnailUrl: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              />
            </label>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Descrição (opcional)
              <input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={working}
              onClick={() => void submit()}
              className="rounded-lg bg-[color:var(--gold)] px-4 py-2 text-xs uppercase tracking-[0.14em] text-[color:var(--navy-deep,#0b1b33)] disabled:opacity-50"
            >
              {draft.chapterKey ? "Publicar nova versão" : "Adicionar capítulo"}
            </button>
            {draft.chapterKey ? (
              <button
                type="button"
                onClick={() => setDraft({ ...EMPTY_DRAFT })}
                className="rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs uppercase tracking-[0.14em]"
              >
                Cancelar edição
              </button>
            ) : null}
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Editar não apaga: a versão anterior continua registrada.
            </p>
          </div>
        </section>
      </div>
    </ExecutiveShell>
  );
}
