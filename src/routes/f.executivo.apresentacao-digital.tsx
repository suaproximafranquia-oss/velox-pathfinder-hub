/**
 * APRESENTAÇÃO DIGITAL — UM VÍDEO E UMA DESCRIÇÃO POR AMBIENTE.
 *
 * Ferramenta deliberadamente simples: seletor de ambiente, player,
 * descrição e publicação. Não existe roteiro, capítulo, capa nem
 * sequência de vídeos. Financeira, Solar e Seguradora permanecem
 * isoladas; a infraestrutura de publicação (uma vigente por ambiente,
 * histórico append-only e proteção contra falha parcial) é reutilizada
 * exatamente como já estava.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Save, Video } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceResourceGuard } from "@/components/executive/workspace-resource-guard";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  ENVIRONMENT_PRESENTATION_KEYS,
  listarApresentacoesAmbiente,
  permissaoApresentacao,
  salvarApresentacaoAmbiente,
} from "@/lib/relationship/presentation.functions";

export const Route = createFileRoute("/f/executivo/apresentacao-digital")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Apresentação Digital — Atlas Platform" },
      {
        name: "description",
        content:
          "Vídeo e descrição da apresentação vigente de cada ambiente: Financeira, Solar e Seguradora.",
      },
      { property: "og:title", content: "Apresentação Digital — Atlas Platform" },
      {
        property: "og:description",
        content: "Uma apresentação em vídeo vigente por ambiente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <WorkspaceResourceGuard resource="apresentacao_digital">
      <ApresentacaoDigitalPage />
    </WorkspaceResourceGuard>
  ),
});

const LABEL: Record<string, string> = {
  financeira: "Financeira",
  solar: "Solar",
  seguradora: "Seguradora",
};

type Item = {
  environment: string;
  introText: string | null;
  videoUrl: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
};

type Draft = { videoUrl: string; description: string; isPublished: boolean };

const EMPTY: Draft = { videoUrl: "", description: "", isPublished: false };

/** Aceita link normal do YouTube/Vimeo e devolve a forma reproduzível. */
function toEmbedUrl(url: string): string {
  const value = url.trim();
  const youtube = value.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return value;
}

function isFileVideo(url: string) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url.trim());
}

function VideoPlayer({ url, title }: { url: string; title: string }) {
  if (isFileVideo(url)) {
    return (
      <video src={url} controls className="h-full w-full" aria-label={title}>
        <track kind="captions" />
      </video>
    );
  }
  return (
    <iframe
      src={toEmbedUrl(url)}
      title={title}
      loading="lazy"
      allowFullScreen
      className="h-full w-full"
    />
  );
}

function ApresentacaoDigitalPage() {
  const readPermission = useServerFn(permissaoApresentacao);
  const list = useServerFn(listarApresentacoesAmbiente);
  const save = useServerFn(salvarApresentacaoAmbiente);

  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [environment, setEnvironment] = useState<string>(ENVIRONMENT_PRESENTATION_KEYS[0]);
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [investorView, setInvestorView] = useState(false);

  const load = useCallback(async () => {
    try {
      const permission = await readPermission({});
      setAllowed(permission.allowed);
      if (!permission.allowed) return;
      setItems((await list({})) as Item[]);
    } catch (error) {
      setAllowed(false);
      toast.error(error instanceof Error ? error.message : "Falha ao carregar a apresentação.");
    }
  }, [readPermission, list]);

  useEffect(() => {
    setSession(getSession());
    void load();
  }, [load]);

  // Ao trocar de ambiente, o editor reflete a apresentação daquele ambiente.
  useEffect(() => {
    const found = items.find((item) => item.environment === environment);
    setDraft(
      found
        ? {
            videoUrl: found.videoUrl ?? "",
            description: found.introText ?? "",
            isPublished: found.isPublished,
          }
        : { ...EMPTY },
    );
  }, [environment, items]);

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          environment,
          introText: draft.description,
          videoUrl: draft.videoUrl,
          isPublished: draft.isPublished,
        },
      });
      setItems((await list({})) as Item[]);
      toast.success(`Apresentação da ${LABEL[environment]} salva.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
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
            A Apresentação Digital depende de permissão administrativa. Ela não é liberada pelo
            cargo operacional.
          </p>
        </div>
      </ExecutiveShell>
    );
  }

  const published = items.find((item) => item.environment === environment && item.isPublished);

  return (
    <ExecutiveShell session={session!} title="Apresentação Digital">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* 1. Ambiente */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-[color:var(--border)] p-1">
            {ENVIRONMENT_PRESENTATION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setEnvironment(key);
                  setInvestorView(false);
                }}
                className={`rounded px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] ${
                  environment === key
                    ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                    : "text-[color:var(--muted-foreground)]"
                }`}
              >
                {LABEL[key]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setInvestorView((value) => !value)}
            className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {investorView ? "Voltar à edição" : "Ver como o investidor"}
          </button>
        </div>

        {investorView ? (
          /* 7. Página pública: player + descrição, nada mais. */
          published && published.videoUrl ? (
            <section className="space-y-4">
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                <VideoPlayer
                  url={published.videoUrl}
                  title={`Apresentação — ${LABEL[environment]}`}
                />
              </div>
              {published.introText ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-[color:var(--foreground)]">
                  {published.introText}
                </p>
              ) : null}
            </section>
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] p-10 text-center">
              <Video className="mx-auto h-6 w-6 text-[color:var(--muted-foreground)]" aria-hidden />
              <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                Nenhuma apresentação publicada para {LABEL[environment]}.
              </p>
            </div>
          )
        ) : (
          <section className="space-y-5">
            {/* 2. Player */}
            {draft.videoUrl.trim() ? (
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                <VideoPlayer
                  url={draft.videoUrl}
                  title={`Apresentação — ${LABEL[environment]}`}
                />
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--border)] text-center">
                <Video className="h-6 w-6 text-[color:var(--muted-foreground)]" aria-hidden />
                <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                  Nenhuma apresentação configurada para {LABEL[environment]}.
                </p>
              </div>
            )}

            <label className="block text-xs text-[color:var(--muted-foreground)]">
              URL do vídeo
              <input
                value={draft.videoUrl}
                onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })}
                placeholder="https://"
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              />
            </label>

            {/* 3. Descrição */}
            <label className="block text-xs text-[color:var(--muted-foreground)]">
              Descrição da apresentação
              <textarea
                rows={6}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              />
            </label>

            {/* 4. Publicar / salvar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={draft.isPublished}
                  onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })}
                />
                Publicada
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-4 py-2 text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                Salvar
              </button>
            </div>

            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Uma apresentação vigente por ambiente. Salvar aqui não afeta os outros ambientes; a
              versão anterior fica preservada no histórico.
            </p>
          </section>
        )}
      </div>
    </ExecutiveShell>
  );
}
