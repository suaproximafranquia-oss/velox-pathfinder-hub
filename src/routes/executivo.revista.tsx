/**
 * REVISTA VELOX + MÓDULOS INSTITUCIONAIS — administração.
 *
 * Aqui a Gestão publica as edições da Revista (cada uma vigente por 10
 * dias corridos), monta as páginas duplas e mantém os conteúdos dos
 * módulos "Nossa Estrutura" e "Princípios Velox" do Portal.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  deleteInstitutionalContent,
  setMagazineEditionPublished,
  deleteMagazinePage,
  listInstitutionalContent,
  listMagazineEditions,
  saveInstitutionalContent,
  saveMagazineEdition,
  saveMagazinePage,
  uploadMagazineFile,
} from "@/lib/magazine.functions";
import type { InstitutionalBlock } from "@/server/magazine.server";
import {
  editionStatus,
  formatEditionCode,
  formatPeriod,
  nextEditionNumber,
  todayInSaoPaulo,
  type MagazineEdition,
  type MediaKind,
} from "@/lib/magazine/edition";

export const Route = createFileRoute("/executivo/revista")({
  head: () => ({
    meta: [
      { title: "Revista Velox — Atlas Platform" },
      {
        name: "description",
        content:
          "Publicação das edições da Revista Velox e dos módulos institucionais do Portal do Investidor.",
      },
      { property: "og:title", content: "Revista Velox — Atlas Platform" },
      {
        property: "og:description",
        content: "Edições de 10 dias, páginas duplas e conteúdos institucionais do Portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RevistaAdminPage,
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

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

type EditionDraft = {
  id: string | null;
  number: number;
  title: string;
  subtitle: string;
  coverUrl: string;
  startsOn: string;
  published: boolean;
};

type PageDraft = {
  id: string | null;
  position: number;
  eyebrow: string;
  title: string;
  body: string;
  caption: string;
  mediaKind: MediaKind;
  mediaUrl: string;
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

const emptyPage: PageDraft = {
  id: null,
  position: 1,
  eyebrow: "",
  title: "",
  body: "",
  caption: "",
  mediaKind: "none",
  mediaUrl: "",
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

function RevistaAdminPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [editions, setEditions] = useState<MagazineEdition[]>([]);
  const [blocks, setBlocks] = useState<InstitutionalBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editionDraft, setEditionDraft] = useState<EditionDraft | null>(null);
  const [pageDraft, setPageDraft] = useState<PageDraft>(emptyPage);
  const [blockDraft, setBlockDraft] = useState<BlockDraft>(emptyBlock);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const load = useCallback(async () => {
    try {
      await ensureCloudSession();
      const [rows, institutional] = await Promise.all([
        listMagazineEditions(),
        listInstitutionalContent(),
      ]);
      setEditions(rows);
      setBlocks(institutional);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a Revista.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const edition = useMemo(
    () => editions.find((e) => e.id === selectedId) ?? null,
    [editions, selectedId],
  );

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

  async function upload(file: File): Promise<string> {
    const base64 = await toBase64(file);
    const { reference } = await uploadMagazineFile({
      data: { fileName: file.name, mimeType: file.type || "application/octet-stream", base64 },
    });
    return reference;
  }

  if (!session) return null;

  const canManage = session.activeRole === "super_admin" || session.activeRole === "diretora";
  if (!canManage) {
    return (
      <ExecutiveShell session={session} title="Revista Velox">
        <div className={card}>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            A publicação da Revista Velox está disponível apenas para a Gestão.
          </p>
        </div>
      </ExecutiveShell>
    );
  }

  return (
    <ExecutiveShell session={session} title="Revista Velox">
      <div className="space-y-6">
        <header className={card}>
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="text-sm">Publicação institucional do Portal do Investidor</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[color:var(--muted-foreground)]">
            Cada edição fica vigente por 10 dias corridos a partir da data de início e depois vai
            automaticamente para o acervo, sem deixar de ser legível. As páginas são exibidas em
            formato de revista aberta: texto de um lado, imagem ou vídeo do outro.
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

        {/* Edições */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm">Edições</h3>
            <button
              type="button"
              className={gold}
              disabled={busy}
              onClick={() =>
                setEditionDraft({
                  id: null,
                  number: nextEditionNumber(editions),
                  title: "",
                  subtitle: "",
                  coverUrl: "",
                  startsOn: todayInSaoPaulo(),
                  published: false,
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Nova edição
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {editions.length === 0 && (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Nenhuma edição criada até o momento.
              </p>
            )}
            {editions.map((item) => (
              <div
                key={item.id}
                className={
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 " +
                  (item.id === selectedId
                    ? "border-[color:var(--gold)]/50"
                    : "border-[color:var(--border)]")
                }
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedId(item.id)}
                >
                  <p className="text-sm">
                    {formatEditionCode(item.number)} — {item.title}
                  </p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    {item.pages.length === 0
                      ? "Contagem inicia no primeiro conteúdo publicado"
                      : formatPeriod(item.startsOn)}{" "}
                    · {EDITION_STATUS_LABEL[editionStatus(item)]} · {item.pages.length} conteúdo(s)
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={ghost}
                    disabled={busy}
                    onClick={() =>
                      setEditionDraft({
                        id: item.id,
                        number: item.number,
                        title: item.title,
                        subtitle: item.subtitle ?? "",
                        coverUrl: "",
                        startsOn: item.startsOn,
                        published: item.published,
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
                        if (
                          item.published &&
                          !window.confirm(
                            `Desativar a ${formatEditionCode(item.number)}? Ela deixa de aparecer no Portal, mas nada é apagado.`,
                          )
                        )
                          return;
                        setEditions(
                          await setMagazineEditionPublished({
                            data: { id: item.id, published: !item.published },
                          }),
                        );
                      }, item.published ? "Edição desativada." : "Edição ativada.")
                    }
                  >
                    {item.published ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {editionDraft && (
            <div className="mt-5 space-y-3 rounded-xl border border-[color:var(--border)] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-[color:var(--muted-foreground)]">
                  Número
                  <input
                    type="number"
                    className={field}
                    value={editionDraft.number}
                    onChange={(e) =>
                      setEditionDraft({ ...editionDraft, number: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="text-xs text-[color:var(--muted-foreground)]">
                  Início da edição
                  <input
                    type="date"
                    className={field}
                    value={editionDraft.startsOn}
                    onChange={(e) => setEditionDraft({ ...editionDraft, startsOn: e.target.value })}
                  />
                </label>
              </div>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Título
                <input
                  className={field}
                  value={editionDraft.title}
                  onChange={(e) => setEditionDraft({ ...editionDraft, title: e.target.value })}
                />
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Subtítulo
                <input
                  className={field}
                  value={editionDraft.subtitle}
                  onChange={(e) => setEditionDraft({ ...editionDraft, subtitle: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={editionDraft.published}
                  onChange={(e) =>
                    setEditionDraft({ ...editionDraft, published: e.target.checked })
                  }
                />
                Publicar no Portal do Investidor
              </label>
              <label className={ghost + " cursor-pointer"}>
                <Upload className="h-3.5 w-3.5" /> Capa da edição
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void run(async () => {
                      const reference = await upload(file);
                      setEditionDraft((d) => (d ? { ...d, coverUrl: reference } : d));
                    }, "Capa enviada.");
                  }}
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={gold}
                  disabled={busy || editionDraft.title.trim().length < 2}
                  onClick={() =>
                    void run(async () => {
                      const rows = await saveMagazineEdition({
                        data: {
                          id: editionDraft.id,
                          number: editionDraft.number,
                          title: editionDraft.title,
                          subtitle: editionDraft.subtitle || null,
                          coverUrl: editionDraft.coverUrl || null,
                          startsOn: editionDraft.startsOn,
                          published: editionDraft.published,
                          createdByName: session.name,
                        },
                      });
                      setEditions(rows);
                      setEditionDraft(null);
                    }, "Edição salva.")
                  }
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar edição
                </button>
                <button type="button" className={ghost} onClick={() => setEditionDraft(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Páginas da edição selecionada */}
        {edition && (
          <section className={card}>
            <h3 className="text-sm">
              Páginas de {formatEditionCode(edition.number)} — {edition.title}
            </h3>
            <div className="mt-3 space-y-2">
              {edition.pages.map((page) => (
                <div
                  key={page.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm">
                      {page.position}. {page.title}
                    </p>
                    <p className="text-[11px] text-[color:var(--muted-foreground)]">
                      {MEDIA_LABEL[page.mediaKind]}
                      {page.caption ? ` · ${page.caption}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={ghost}
                      onClick={() =>
                        setPageDraft({
                          id: page.id,
                          position: page.position,
                          eyebrow: page.eyebrow ?? "",
                          title: page.title,
                          body: page.body,
                          caption: page.caption ?? "",
                          mediaKind: page.mediaKind,
                          mediaUrl: "",
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
                          setEditions(await deleteMagazinePage({ data: { id: page.id } }));
                        }, "Página removida.")
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              ))}
              {edition.pages.length === 0 && (
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  Nenhuma página nesta edição.
                </p>
              )}
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-[color:var(--border)] p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs text-[color:var(--muted-foreground)]">
                  Ordem
                  <input
                    type="number"
                    className={field}
                    value={pageDraft.position}
                    onChange={(e) =>
                      setPageDraft({ ...pageDraft, position: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="text-xs text-[color:var(--muted-foreground)]">
                  Chapéu
                  <input
                    className={field}
                    value={pageDraft.eyebrow}
                    onChange={(e) => setPageDraft({ ...pageDraft, eyebrow: e.target.value })}
                  />
                </label>
                <label className="text-xs text-[color:var(--muted-foreground)]">
                  Mídia da página
                  <select
                    className={field}
                    value={pageDraft.mediaKind}
                    onChange={(e) =>
                      setPageDraft({ ...pageDraft, mediaKind: e.target.value as MediaKind })
                    }
                  >
                    <option value="none">Sem mídia</option>
                    <option value="imagem">Imagem</option>
                    <option value="video">Vídeo</option>
                  </select>
                </label>
              </div>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Título da página
                <input
                  className={field}
                  value={pageDraft.title}
                  onChange={(e) => setPageDraft({ ...pageDraft, title: e.target.value })}
                />
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Texto (uma linha em branco separa parágrafos)
                <textarea
                  className={field + " min-h-32"}
                  value={pageDraft.body}
                  onChange={(e) => setPageDraft({ ...pageDraft, body: e.target.value })}
                />
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Legenda da mídia
                <input
                  className={field}
                  value={pageDraft.caption}
                  onChange={(e) => setPageDraft({ ...pageDraft, caption: e.target.value })}
                />
              </label>
              {pageDraft.mediaKind !== "none" && (
                <label className={ghost + " cursor-pointer"}>
                  <Upload className="h-3.5 w-3.5" />
                  {pageDraft.mediaUrl ? "Arquivo pronto" : "Enviar imagem ou vídeo"}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void run(async () => {
                        const reference = await upload(file);
                        setPageDraft((d) => ({ ...d, mediaUrl: reference }));
                      }, "Mídia enviada.");
                    }}
                  />
                </label>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={gold}
                  disabled={busy || pageDraft.title.trim().length < 2}
                  onClick={() =>
                    void run(async () => {
                      const rows = await saveMagazinePage({
                        data: {
                          id: pageDraft.id,
                          editionId: edition.id,
                          position: pageDraft.position,
                          eyebrow: pageDraft.eyebrow || null,
                          title: pageDraft.title,
                          body: pageDraft.body,
                          caption: pageDraft.caption || null,
                          mediaKind: pageDraft.mediaKind,
                          mediaUrl: pageDraft.mediaUrl || null,
                        },
                      });
                      setEditions(rows);
                      setPageDraft({ ...emptyPage, position: pageDraft.position + 1 });
                    }, "Página salva.")
                  }
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar página
                </button>
                <button type="button" className={ghost} onClick={() => setPageDraft(emptyPage)}>
                  Limpar
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Módulos institucionais */}
        <section className={card}>
          <h3 className="text-sm">Módulos institucionais do Portal</h3>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            Conteúdos exibidos em "Nossa Estrutura" e "Princípios Velox".
          </p>

          <div className="mt-4 space-y-2">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3"
              >
                <div>
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
                      setBlockDraft({
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
                  value={blockDraft.module}
                  onChange={(e) =>
                    setBlockDraft({
                      ...blockDraft,
                      module: e.target.value as BlockDraft["module"],
                    })
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
                  value={blockDraft.position}
                  onChange={(e) =>
                    setBlockDraft({ ...blockDraft, position: Number(e.target.value) })
                  }
                />
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Mídia
                <select
                  className={field}
                  value={blockDraft.mediaKind}
                  onChange={(e) =>
                    setBlockDraft({ ...blockDraft, mediaKind: e.target.value as MediaKind })
                  }
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
                value={blockDraft.eyebrow}
                onChange={(e) => setBlockDraft({ ...blockDraft, eyebrow: e.target.value })}
              />
            </label>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Título
              <input
                className={field}
                value={blockDraft.title}
                onChange={(e) => setBlockDraft({ ...blockDraft, title: e.target.value })}
              />
            </label>
            <label className="text-xs text-[color:var(--muted-foreground)]">
              Texto
              <textarea
                className={field + " min-h-32"}
                value={blockDraft.body}
                onChange={(e) => setBlockDraft({ ...blockDraft, body: e.target.value })}
              />
            </label>
            {blockDraft.mediaKind !== "none" && (
              <label className={ghost + " cursor-pointer"}>
                <Upload className="h-3.5 w-3.5" />
                {blockDraft.mediaUrl ? "Arquivo pronto" : "Enviar imagem ou vídeo"}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void run(async () => {
                      const reference = await upload(file);
                      setBlockDraft((d) => ({ ...d, mediaUrl: reference }));
                    }, "Mídia enviada.");
                  }}
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={blockDraft.active}
                onChange={(e) => setBlockDraft({ ...blockDraft, active: e.target.checked })}
              />
              Visível no Portal
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={gold}
                disabled={busy || blockDraft.title.trim().length < 2}
                onClick={() =>
                  void run(async () => {
                    const rows = await saveInstitutionalContent({
                      data: {
                        id: blockDraft.id,
                        module: blockDraft.module,
                        position: blockDraft.position,
                        eyebrow: blockDraft.eyebrow || null,
                        title: blockDraft.title,
                        body: blockDraft.body,
                        mediaKind: blockDraft.mediaKind,
                        mediaUrl: blockDraft.mediaUrl || null,
                        active: blockDraft.active,
                      },
                    });
                    setBlocks(rows);
                    setBlockDraft({ ...emptyBlock, position: blockDraft.position + 1 });
                  }, "Conteúdo salvo.")
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar conteúdo
              </button>
              <button type="button" className={ghost} onClick={() => setBlockDraft(emptyBlock)}>
                Limpar
              </button>
            </div>
          </div>
        </section>
      </div>
    </ExecutiveShell>
  );
}
