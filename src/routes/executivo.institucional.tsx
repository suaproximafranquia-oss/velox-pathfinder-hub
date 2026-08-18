/**
 * MÓDULOS INSTITUCIONAIS — administração de "Nossa Estrutura" e
 * "Princípios Velox".
 *
 * Vive fora da Revista Velox: são módulos próprios do Portal e não
 * fazem parte da edição da revista.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Trash2, Upload } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  deleteInstitutionalContent,
  listInstitutionalContent,
  saveInstitutionalContent,
  uploadMagazineFile,
} from "@/lib/magazine.functions";
import type { InstitutionalBlock } from "@/server/magazine.server";
import type { MediaKind } from "@/lib/magazine/edition";

export const Route = createFileRoute("/executivo/institucional")({
  head: () => ({
    meta: [
      { title: "Módulos Institucionais — Atlas Platform" },
      {
        name: "description",
        content: "Conteúdos de Nossa Estrutura e Princípios Velox exibidos no Portal do Investidor.",
      },
      { property: "og:title", content: "Módulos Institucionais — Atlas Platform" },
      {
        property: "og:description",
        content: "Administração dos módulos Nossa Estrutura e Princípios Velox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InstitucionalAdminPage,
});

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";
const gold =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-4 py-2 text-xs text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40";
const ghost =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition disabled:opacity-40";
const field =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50";

const MEDIA_LABEL: Record<MediaKind, string> = {
  none: "Sem mídia",
  imagem: "Imagem",
  video: "Vídeo",
};

type BlockDraft = {
  id: string | null;
  module: "estrutura" | "principios";
  position: number;
  eyebrow: string;
  title: string;
  body: string;
  mediaKind: MediaKind;
  mediaUrl: string;
  active: boolean;
};

const emptyBlock: BlockDraft = {
  id: null,
  module: "estrutura",
  position: 1,
  eyebrow: "",
  title: "",
  body: "",
  mediaKind: "none",
  mediaUrl: "",
  active: true,
};

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function InstitucionalAdminPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [blocks, setBlocks] = useState<InstitutionalBlock[]>([]);
  const [draft, setDraft] = useState<BlockDraft>(emptyBlock);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const load = useCallback(async () => {
    try {
      await ensureCloudSession();
      setBlocks(await listInstitutionalContent());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os módulos.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensureCloudSession();
      await action();
      setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  const canManage = session.activeRole === "super_admin" || session.activeRole === "diretora";
  if (!canManage) {
    return (
      <ExecutiveShell session={session} title="Módulos Institucionais">
        <div className={card}>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Estes conteúdos são administrados apenas pela Gestão.
          </p>
        </div>
      </ExecutiveShell>
    );
  }

  return (
    <ExecutiveShell session={session} title="Módulos Institucionais">
      <div className="space-y-6">
        <header className={card}>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="text-sm">Nossa Estrutura e Princípios Velox</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[color:var(--muted-foreground)]">
            Conteúdos permanentes do Portal do Investidor, independentes das edições da Revista.
          </p>
        </header>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-3 text-xs text-[color:var(--gold)]">
            {notice}
          </p>
        )}

        <section className={card}>
          <div className="space-y-2">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {block.position}. {block.title}
                  </p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    {block.module === "estrutura" ? "Nossa Estrutura" : "Princípios Velox"} ·{" "}
                    {MEDIA_LABEL[block.mediaKind]} · {block.active ? "ativo" : "inativo"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={ghost}
                    onClick={() =>
                      setDraft({
                        id: block.id,
                        module: block.module,
                        position: block.position,
                        eyebrow: block.eyebrow ?? "",
                        title: block.title,
                        body: block.body,
                        mediaKind: block.mediaKind,
                        mediaUrl: "",
                        active: block.active,
                      })
                    }
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        if (!window.confirm(`Excluir "${block.title}"?`)) return;
                        setBlocks(await deleteInstitutionalContent({ data: { id: block.id } }));
                      }, "Conteúdo removido.")
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>
              </div>
            ))}
            {blocks.length === 0 && (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Nenhum conteúdo institucional cadastrado.
              </p>
            )}
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-[color:var(--border)] p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Módulo
                <select
                  className={field}
                  value={draft.module}
                  onChange={(e) =>
                    setDraft({ ...draft, module: e.target.value as BlockDraft["module"] })
                  }
                >
                  <option value="estrutura">Nossa Estrutura</option>
                  <option value="principios">Princípios Velox</option>
                </select>
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Ordem
                <input
                  type="number"
                  className={field}
                  value={draft.position}
                  onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Mídia
                <select
                  className={field}
                  value={draft.mediaKind}
                  onChange={(e) => setDraft({ ...draft, mediaKind: e.target.value as MediaKind })}
                >
                  <option value="none">Sem mídia</option>
                  <option value="imagem">Imagem</option>
                  <option value="video">Vídeo institucional</option>
                </select>
              </label>
            </div>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Chapéu
              <input
                className={field}
                value={draft.eyebrow}
                onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })}
              />
            </label>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Título
              <input
                className={field}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Texto
              <textarea
                className={field + " min-h-32"}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </label>
            {draft.mediaKind !== "none" && (
              <label className={ghost + " cursor-pointer"}>
                <Upload className="h-3.5 w-3.5" />
                {draft.mediaUrl ? "Arquivo pronto" : "Enviar imagem ou vídeo"}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void run(async () => {
                      const base64 = await toBase64(file);
                      const { reference } = await uploadMagazineFile({
                        data: {
                          fileName: file.name,
                          mimeType: file.type || "application/octet-stream",
                          base64,
                        },
                      });
                      setDraft((d) => ({ ...d, mediaUrl: reference }));
                    }, "Mídia enviada.");
                  }}
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Visível no Portal
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={gold}
                disabled={busy || draft.title.trim().length < 2}
                onClick={() =>
                  void run(async () => {
                    const rows = await saveInstitutionalContent({
                      data: {
                        id: draft.id,
                        module: draft.module,
                        position: draft.position,
                        eyebrow: draft.eyebrow || null,
                        title: draft.title,
                        body: draft.body,
                        mediaKind: draft.mediaKind,
                        mediaUrl: draft.mediaUrl || null,
                        active: draft.active,
                      },
                    });
                    setBlocks(rows);
                    setDraft({ ...emptyBlock, position: draft.position + 1 });
                  }, "Conteúdo salvo.")
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar conteúdo
              </button>
              <button type="button" className={ghost} onClick={() => setDraft(emptyBlock)}>
                Limpar
              </button>
            </div>
          </div>
        </section>
      </div>
    </ExecutiveShell>
  );
}