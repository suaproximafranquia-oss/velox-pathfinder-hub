import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderOpen, Plus, Trash2, ExternalLink, Search } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { can } from "@/lib/governance";
import {
  createResource,
  listResources,
  removeResource,
  RESOURCE_KIND_LABEL,
  type ResourceItem,
  type ResourceKind,
  type ResourceVisibility,
} from "@/lib/resources";
import { onEvent } from "@/lib/events/bus";

export const Route = createFileRoute("/f/executivo/recursos")({
  head: () => ({
    meta: [
      { title: "Centro de Recursos — Portal Velox" },
      {
        name: "description",
        content:
          "Gestão de ativos institucionais reutilizáveis: apresentações, PDFs, vídeos, materiais comerciais e treinamentos.",
      },
    ],
  }),
  component: RecursosPage,
});

function RecursosPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ResourceKind | "">("");

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newKind, setNewKind] = useState<ResourceKind>("pdf");
  const [version, setVersion] = useState("1.0");
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [visibility, setVisibility] = useState<ResourceVisibility>("restrito");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    const refresh = () =>
      setItems(
        listResources(session.workspaceId, {
          query: query || undefined,
          kind: kind || undefined,
        }),
      );
    refresh();
    return onEvent((e) => {
      if (e.type.startsWith("resource.")) refresh();
    });
  }, [session, query, kind]);

  function add(activeSession: ExecutiveSession) {
    if (!can(activeSession.activeRole, "resources.manage")) return;
    const clean = title.trim();
    if (!clean) return;
    createResource(
      {
        workspaceId: activeSession.workspaceId,
        title: clean,
        description: description.trim() || undefined,
        kind: newKind,
        version: version.trim() || "1.0",
        author: activeSession.name,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        url: url.trim() || undefined,
        visibility,
        category: category.trim() || undefined,
      },
      {
        id: activeSession.userId,
        name: activeSession.name,
        role: activeSession.activeRole,
      },
    );
    setTitle("");
    setDescription("");
    setUrl("");
    setKeywords("");
    setCategory("");
  }

  if (!session) return null;
  const role = session.activeRole;
  const mayManage = can(role, "resources.manage");
  const activeSession = session;

  return (
    <ExecutiveShell session={session} title="Centro de Recursos">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="flex items-start gap-3">
          <FolderOpen className="h-6 w-6 text-[color:var(--gold)] mt-1" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              Ativos institucionais
            </p>
            <h1 className="font-display text-3xl">Centro de Recursos</h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-1 max-w-2xl">
              Organize materiais reutilizáveis com categoria, versão e
              palavras-chave. A Base de Conhecimento pode referenciá-los sem
              duplicação física.
            </p>
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--muted-foreground)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar recursos..."
              className="w-full rounded-full bg-[color:var(--background)] border border-[color:var(--border)] pl-9 pr-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
            />
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ResourceKind | "")}
            className="rounded-full bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm"
          >
            <option value="">Todos os formatos</option>
            {Object.entries(RESOURCE_KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </section>

        {mayManage && (
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-3">
              Novo recurso
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título"
                className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
              />
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as ResourceKind)}
                className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm"
              >
                {Object.entries(RESOURCE_KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Categoria"
                className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
              />
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Versão"
                className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="URL (opcional)"
                className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60 md:col-span-2"
              />
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Palavras-chave (separadas por vírgula)"
                className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60 md:col-span-2"
              />
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ResourceVisibility)}
                className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm"
              >
                <option value="restrito">Restrito</option>
                <option value="publico">Público</option>
              </select>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Descrição"
                className="rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60 md:col-span-2"
              />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => add(activeSession)}
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--gold)] px-5 py-2 text-sm font-medium text-[color:var(--brand-blue-deep)] hover:brightness-105"
              >
                <Plus className="h-4 w-4" /> Publicar recurso
              </button>
            </div>
          </section>
        )}

        <section>
          {items.length === 0 ? (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Nenhum recurso publicado ainda.
            </p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                        {RESOURCE_KIND_LABEL[r.kind]}
                        {r.category ? ` · ${r.category}` : ""} · v{r.version}
                      </p>
                      <p className="font-display text-base mt-1 truncate">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-[color:var(--muted-foreground)] mt-1 leading-relaxed">
                          {r.description}
                        </p>
                      )}
                      {r.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.keywords.map((k) => (
                            <span
                              key={k}
                              className="text-[10px] rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[color:var(--muted-foreground)]"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full p-1.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--gold)]"
                          aria-label="Abrir"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {mayManage && (
                        <button
                          type="button"
                          onClick={() =>
                            removeResource(r.id, {
                              id: session.userId,
                              name: session.name,
                              role,
                            })
                          }
                          className="rounded-full p-1.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--gold)]"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-[color:var(--muted-foreground)] mt-3">
                    {r.visibility === "publico" ? "Público" : "Restrito"} · por {r.author}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ExecutiveShell>
  );
}