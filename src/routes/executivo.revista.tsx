/**
 * REVISTA VELOX — administração.
 *
 * Fluxo enxuto: a Gestão cria UMA edição por vez, adiciona conteúdos em
 * sequência (título + texto + anexo) e visualiza a revista exatamente
 * como o investidor a lê. Edição nunca é excluída — apenas desativada.
 * Os módulos institucionais têm página própria.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, Eye, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { MagazineReader } from "@/components/portal/magazine-reader";
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  setMagazineEditionPublished,
  deleteMagazineEdition,
  deleteMagazinePage,

  listMagazineEditions,
  saveMagazineEdition,
  saveMagazinePage,
  uploadMagazineFile,
} from "@/lib/magazine.functions";
import {
  canCreateEdition,
  editionStatus,
  editionNeedsSuccessor,
  EDITION_STATUS_LABEL,
  PAGE_BODY_MAX,
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
        content: "Publicação das edições de 10 dias da Revista Velox no Portal do Investidor.",
      },
      { property: "og:title", content: "Revista Velox — Atlas Platform" },
      {
        property: "og:description",
        content: "Edições de 10 dias em página dupla, publicadas para o Portal do Investidor.",
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
  published: boolean;
};

type ContentDraft = {
  id: string | null;
  title: string;
  body: string;
  caption: string;
  mediaKind: MediaKind;
  mediaUrl: string;
  fileName: string;
};

const emptyContent: ContentDraft = {
  id: null,
  title: "",
  body: "",
  caption: "",
  mediaKind: "none",
  mediaUrl: "",
  fileName: "",
};

function RevistaAdminPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [editions, setEditions] = useState<MagazineEdition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editionDraft, setEditionDraft] = useState<EditionDraft | null>(null);
  const [content, setContent] = useState<ContentDraft>(emptyContent);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const load = useCallback(async () => {
    try {
      await ensureCloudSession();
      const rows = await listMagazineEditions();
      setEditions(rows);
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
  const preview = useMemo(
    () => editions.find((e) => e.id === previewId) ?? null,
    [editions, previewId],
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

  const canCreate = canCreateEdition(editions);
  const ended = editionNeedsSuccessor(editions);

  return (
    <ExecutiveShell session={session} title="Revista Velox">
      <div className="space-y-6">
        <header className={card}>
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="text-sm">Publicação da Revista</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[color:var(--muted-foreground)]">
            Cada edição vive 10 dias corridos, contados a partir do primeiro conteúdo publicado.
            Depois vai para o acervo e continua legível. Os conteúdos aparecem em página dupla,
            alternando texto e mídia.
          </p>
          <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">
            Nossa Estrutura e Princípios Velox são módulos próprios —{" "}
            <Link to="/executivo/institucional" className="underline">
              administrar módulos institucionais
            </Link>
            .
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
          {ended && (
            <p className="mb-4 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-3 text-xs text-[color:var(--gold)]">
              A {formatEditionCode(ended.number)} encerrou seu ciclo de 10 dias e foi para o acervo.
              Crie a próxima edição para manter a Revista viva no Portal.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm">Edições</h3>
            <button
              type="button"
              className={gold}
              disabled={busy || !canCreate}
              title={
                canCreate
                  ? undefined
                  : "Conclua o ciclo da edição atual antes de criar a próxima."
              }
              onClick={() =>
                setEditionDraft({
                  id: null,
                  number: nextEditionNumber(editions),
                  title: "",
                  subtitle: "",
                  coverUrl: "",
                  published: true,
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
                <button type="button" className="min-w-0 text-left" onClick={() => setSelectedId(item.id)}>
                  <p className="text-sm">
                    {formatEditionCode(item.number)} — {item.title}
                  </p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    {item.pages.length === 0
                      ? "Aguardando o primeiro conteúdo"
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
                        published: item.published,
                      })
                    }
                  >
                    Editar
                  </button>
                  <button type="button" className={ghost} onClick={() => setPreviewId(item.id)}>
                    <Eye className="h-3.5 w-3.5" /> Visualizar
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    disabled={busy}
                    onClick={() =>
                      void run(
                        async () => {
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
                        },
                        item.published ? "Edição desativada." : "Edição ativada.",
                      )
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
              <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                {formatEditionCode(editionDraft.number)}
              </p>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Título da edição
                <input
                  className={field}
                  value={editionDraft.title}
                  onChange={(e) => setEditionDraft({ ...editionDraft, title: e.target.value })}
                />
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Subtítulo (opcional)
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
                Visível no Portal do Investidor
              </label>
              <label className={ghost + " cursor-pointer"}>
                <Upload className="h-3.5 w-3.5" />
                {editionDraft.coverUrl ? "Capa pronta" : "Capa da edição"}
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
                      const existing = editions.find((e) => e.id === editionDraft.id);
                      const rows = await saveMagazineEdition({
                        data: {
                          id: editionDraft.id,
                          number: editionDraft.number,
                          title: editionDraft.title,
                          subtitle: editionDraft.subtitle || null,
                          coverUrl: editionDraft.coverUrl || null,
                          startsOn: existing?.startsOn ?? todayInSaoPaulo(),
                          published: editionDraft.published,
                          createdByName: session.name,
                        },
                      });
                      setEditions(rows);
                      if (!editionDraft.id) {
                        const created = rows.find((r) => r.number === editionDraft.number);
                        if (created) setSelectedId(created.id);
                      }
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

        {edition && (
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm">
                Conteúdos de {formatEditionCode(edition.number)} — {edition.title}
              </h3>
              <div className="flex items-center gap-2">
                <button type="button" className={ghost} onClick={() => setPreviewId(edition.id)}>
                  <Eye className="h-3.5 w-3.5" /> Visualizar revista
                </button>
              </div>


            </div>
            <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
              Cada conteúdo é um par indivisível: texto e mídia ocupam a mesma página dupla. A ordem
              segue a sequência de publicação e é renumerada automaticamente.
            </p>

            <div className="mt-3 space-y-2">
              {edition.pages.map((page) => (
                <div
                  key={page.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {page.position}. {page.title}
                    </p>
                    <p className="text-[11px] text-[color:var(--muted-foreground)]">
                      {page.mediaKind === "none"
                        ? "Sem anexo"
                        : page.mediaKind === "imagem"
                          ? "Imagem"
                          : "Vídeo"}
                      {page.caption ? ` · ${page.caption}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={ghost}
                      onClick={() =>
                        setContent({
                          id: page.id,
                          title: page.title,
                          body: page.body,
                          caption: page.caption ?? "",
                          mediaKind: page.mediaKind,
                          mediaUrl: "",
                          fileName: "",
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
                            !window.confirm(
                              `Excluir o conteúdo "${page.title}"? Texto e mídia são removidos juntos e a edição é renumerada.`,
                            )
                          )
                            return;
                          setEditions(await deleteMagazinePage({ data: { id: page.id } }));
                        }, "Conteúdo removido e edição renumerada.")
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              ))}
              {edition.pages.length === 0 && (
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  Nenhum conteúdo ainda — os 10 dias começam a contar no primeiro conteúdo
                  publicado.
                </p>
              )}
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-[color:var(--border)] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                {content.id ? "Editar conteúdo" : "Novo conteúdo"}
              </p>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Título
                <input
                  className={field}
                  value={content.title}
                  onChange={(e) => setContent({ ...content, title: e.target.value })}
                />
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Texto (uma linha em branco separa parágrafos)
                <textarea
                  className={field + " min-h-32"}
                  maxLength={PAGE_BODY_MAX}
                  value={content.body}
                  onChange={(e) => setContent({ ...content, body: e.target.value })}
                />
                <span className="mt-1 block text-right text-[10px]">
                  {content.body.length}/{PAGE_BODY_MAX} caracteres
                </span>
              </label>
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Legenda do anexo (opcional)
                <input
                  className={field}
                  value={content.caption}
                  onChange={(e) => setContent({ ...content, caption: e.target.value })}
                />
              </label>
              <label className={ghost + " cursor-pointer"}>
                <Upload className="h-3.5 w-3.5" />
                {content.fileName || "Anexar imagem ou vídeo"}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void run(async () => {
                      const reference = await upload(file);
                      setContent((d) => ({
                        ...d,
                        mediaUrl: reference,
                        fileName: file.name,
                        mediaKind: file.type.startsWith("video") ? "video" : "imagem",
                      }));
                    }, "Anexo enviado.");
                  }}
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={gold}
                  disabled={busy || content.title.trim().length < 2}
                  onClick={() =>
                    void run(async () => {
                      const rows = await saveMagazinePage({
                        data: {
                          id: content.id,
                          editionId: edition.id,
                          eyebrow: null,
                          title: content.title,
                          body: content.body,
                          caption: content.caption || null,
                          mediaKind: content.mediaKind,
                          mediaUrl: content.mediaUrl || null,
                        },
                      });
                      setEditions(rows);
                      setContent(emptyContent);
                    }, "Conteúdo publicado na edição.")
                  }
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{" "}
                  {content.id ? "Salvar conteúdo" : "Adicionar conteúdo"}
                </button>
                <button type="button" className={ghost} onClick={() => setContent(emptyContent)}>
                  Limpar
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      <PortalOverlayShell
        open={Boolean(preview)}
        title="Pré-visualização da Revista"
        onClose={() => setPreviewId(null)}
      >
        {preview && (
          <MagazineReader
            edition={preview}
            onDeletePage={(page) =>
              void run(async () => {
                if (
                  !window.confirm(
                    `Excluir o conteúdo "${page.title}"? Texto e mídia são removidos juntos.`,
                  )
                )
                  return;
                setEditions(await deleteMagazinePage({ data: { id: page.id } }));
              }, "Conteúdo removido e edição renumerada.")
            }
          />
        )}
      </PortalOverlayShell>
    </ExecutiveShell>
  );
}
