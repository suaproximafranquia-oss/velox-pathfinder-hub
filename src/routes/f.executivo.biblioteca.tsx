/**
 * BIBLIOTECA DE CONTEÚDOS (COMANDO 3C).
 *
 * Recurso permanente e único do Portal: os materiais cadastrados aqui
 * são os mesmos usados pelo Motor de Relacionamento em homologação e em
 * produção. Um mesmo material pode servir a vários grupos (§7) sem ser
 * duplicado, e nada nesta tela dispara mensagem.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  ExternalLink,
  LibraryBig,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  CONTENT_GROUPS,
  CONTENT_GROUP_LABELS,
  CONTENT_KIND_LABELS,
  contentGroupsOf,
  contentLibraryStats,
  type ContentGroup,
  type ContentKind,
  type ValueContent,
} from "@/lib/relationship/content";
import {
  deleteRelationshipContent,
  listRelationshipContents,
  saveRelationshipContent,
  toggleRelationshipContent,
} from "@/lib/relationship-homologation.functions";
import { MessageLibraryPanel } from "@/components/executive/message-library-panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/f/executivo/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca de Conteúdos — Atlas Platform" },
      {
        name: "description",
        content:
          "Acervo permanente de materiais de valor utilizados pelo Motor de Relacionamento do Portal Velox.",
      },
      { property: "og:title", content: "Biblioteca de Conteúdos — Atlas Platform" },
      {
        property: "og:description",
        content: "Gestão dos materiais de valor por grupo, com histórico de uso e reutilização.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BibliotecaPage,
});

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";
const gold =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-4 py-2 text-xs text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40";
const ghost =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition disabled:opacity-40";
const field =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50";

type Draft = {
  id: string | null;
  groups: ContentGroup[];
  name: string;
  description: string;
  kind: ContentKind;
  url: string;
  body: string;
  active: boolean;
};

/**
 * COMANDO 3F: o cadastro é por LINK. O formato existe apenas para o motor
 * saber como apresentar o conteúdo — não é mais método de cadastro.
 */
const LINK_KINDS: ContentKind[] = ["link", "video", "imagem", "texto"];

const emptyDraft: Draft = {
  id: null,
  groups: ["E1"],
  name: "",
  description: "",
  kind: "link",
  url: "",
  body: "",
  active: true,
};

function BibliotecaPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [contents, setContents] = useState<ValueContent[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<"todos" | ContentGroup>("todos");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setSession(getSession());
  }, []);

  const load = useCallback(async () => {
    try {
      await ensureCloudSession();
      setContents(await listRelationshipContents());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a biblioteca.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => contentLibraryStats(contents), [contents]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contents
      .filter((c) => (filterGroup === "todos" ? true : contentGroupsOf(c).includes(filterGroup)))
      .filter((c) =>
        q ? `${c.name} ${c.description ?? ""}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [contents, filterGroup, query]);

  function toggleGroup(group: ContentGroup) {
    setDraft((d) => ({
      ...d,
      groups: d.groups.includes(group)
        ? d.groups.filter((g) => g !== group)
        : [...d.groups, group],
    }));
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensureCloudSession();
      const next = await saveRelationshipContent({
        data: {
          id: draft.id,
          groups: draft.groups,
          name: draft.name,
          description: draft.description || null,
          kind: draft.kind,
          url: draft.url || null,
          body: draft.body || null,
          storagePath: null,
          mimeType: null,
          active: draft.active,
        },
      });
      setContents(next);
      setDraft(emptyDraft);
      setNotice(draft.id ? "Conteúdo atualizado." : "Conteúdo cadastrado na biblioteca.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o conteúdo.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(content: ValueContent) {
    setDraft({
      id: content.id,
      groups: contentGroupsOf(content) as ContentGroup[],
      name: content.name,
      description: content.description ?? "",
      kind: content.kind,
      url: content.url,
      body: content.body ?? "",
      active: content.active,
    });
    setNotice(null);
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleToggle(content: ValueContent) {
    setBusy(true);
    try {
      await ensureCloudSession();
      setContents(
        await toggleRelationshipContent({ data: { id: content.id, active: !content.active } }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar o status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(content: ValueContent) {
    setBusy(true);
    setError(null);
    try {
      await ensureCloudSession();
      setContents(await deleteRelationshipContent({ data: { id: content.id } }));
      setNotice("Conteúdo removido da biblioteca.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível remover o conteúdo.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  const canManage =
    session.activeRole === "super_admin" || session.activeRole === "diretora";

  if (!canManage) {
    return (
      <ExecutiveShell session={session} title="Biblioteca de Conteúdos">
        <div className={card}>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            A Biblioteca de Conteúdos está disponível apenas para a Gestão.
          </p>
        </div>
      </ExecutiveShell>
    );
  }

  return (
    <ExecutiveShell session={session} title="Biblioteca de Conteúdos">
      <div className="space-y-6">
        <header className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <LibraryBig className="h-4 w-4 text-[color:var(--gold)]" />
                <h2 className="text-sm text-[color:var(--foreground)]">
                  Acervo permanente de materiais de valor
                </h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted-foreground)]">
                Os materiais cadastrados aqui são os mesmos utilizados pelo Motor de
                Relacionamento. Um conteúdo pode pertencer a vários grupos sem ser duplicado.
              </p>
            </div>
            <div className="text-right text-[11px] text-[color:var(--muted-foreground)]">
              <p>{stats.total} conteúdo(s) cadastrado(s)</p>
              <p>{stats.active} ativo(s) · {stats.inactive} inativo(s)</p>
            </div>
          </div>

          {stats.missingRequired.length > 0 ? (
            <p className="mt-3 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 p-3 text-[11px] text-[color:var(--gold)]">
              Grupos obrigatórios sem conteúdo ativo: {stats.missingRequired.join(", ")}. As
              etapas correspondentes não conseguem anexar material.
            </p>
          ) : null}
        </header>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="whitespace-pre-line">{error}</p>
          </div>
        ) : null}
        {notice ? (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            {notice}
          </p>
        ) : null}

        {/* Mensagens do Motor: fonte oficial versionada das cadências. */}
        <MessageLibraryPanel />

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm text-[color:var(--foreground)]">
              {draft.id ? "Editar conteúdo" : "Novo conteúdo"}
            </h2>
            {draft.id ? (
              <button className={ghost} onClick={() => setDraft(emptyDraft)}>
                <X className="h-3.5 w-3.5" /> Cancelar edição
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className={field}
              placeholder="Nome do conteúdo"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className={field}
              placeholder="Descrição / finalidade (opcional)"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <select
              className={field}
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as ContentKind })}
            >
              {LINK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CONTENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Conteúdo ativo (disponível para o motor)
            </label>
          </div>

          {draft.kind === "texto" ? (
            <textarea
              className={cn(field, "mt-3 min-h-28")}
              placeholder="Texto que será enviado"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          ) : (
            <div className="mt-3">
              <input
                className={field}
                placeholder="Link do conteúdo (ex.: https://www.instagram.com/p/ABC/)"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
              <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
                O conteúdo é enviado como link no WhatsApp. Para trocar o material publicado,
                basta atualizar esta URL — nenhum código, template ou etapa muda.
              </p>
            </div>
          )}

          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
              Grupos em que este material pode ser utilizado
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CONTENT_GROUPS.map((group) => {
                const on = draft.groups.includes(group);
                return (
                  <button
                    key={group}
                    onClick={() => toggleGroup(group)}
                    title={CONTENT_GROUP_LABELS[group]}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px] transition",
                      on
                        ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                        : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                    )}
                  >
                    {group}
                  </button>
                );
              })}
            </div>
          </div>

          <button className={cn(gold, "mt-4")} onClick={() => void handleSave()} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {draft.id ? "Salvar alterações" : "Adicionar à biblioteca"}
          </button>
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              className={cn(field, "max-w-52")}
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value as "todos" | ContentGroup)}
            >
              <option value="todos">Todos os grupos</option>
              {CONTENT_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g} — {CONTENT_GROUP_LABELS[g]}
                </option>
              ))}
            </select>
            <input
              className={cn(field, "max-w-72")}
              placeholder="Buscar por nome ou descrição"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="ml-auto text-[11px] text-[color:var(--muted-foreground)]">
              {visible.length} conteúdo(s)
            </span>
          </div>

          {visible.length === 0 ? (
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Nenhum conteúdo encontrado com os filtros atuais.
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[color:var(--foreground)]">
                      {c.name}
                      {c.active ? "" : " · inativo"}
                    </p>
                    <p className="mt-1 text-[color:var(--muted-foreground)]">
                      {CONTENT_KIND_LABELS[c.kind]} · grupos {contentGroupsOf(c).join(", ")} ·
                      usado {c.usageCount}x ·{" "}
                      {c.lastUsedAt
                        ? `último uso ${new Date(c.lastUsedAt).toLocaleDateString("pt-BR")}`
                        : "nunca utilizado"}
                    </p>
                    {c.url ? (
                      <p className="mt-1 truncate text-[10px] text-[color:var(--muted-foreground)]">
                        {c.url}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.url ? (
                      <a className={ghost} href={c.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir conteúdo
                      </a>
                    ) : null}
                    <button className={ghost} onClick={() => startEdit(c)} disabled={busy}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button className={ghost} onClick={() => void handleToggle(c)} disabled={busy}>
                      {c.active ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Desativar
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Ativar
                        </>
                      )}
                    </button>
                    <button className={ghost} onClick={() => void handleDelete(c)} disabled={busy}>
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ExecutiveShell>
  );
}
