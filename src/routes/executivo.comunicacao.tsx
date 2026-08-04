import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Newspaper,
  MessageSquareText,
  Sparkles,
  Loader2,
  Trash2,
  Send,
  Plus,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  listNews,
  saveNews,
  deleteNews,
  listTemplates,
  saveTemplate,
  deleteTemplate,
  listCampaigns,
  saveCampaign,
  deleteCampaign,
  dispatchCampaignNow,
  type NewsPost,
  type MetaTemplate,
  type Campaign,
} from "@/lib/comms.functions";
import { generateCampaignDraft } from "@/lib/campaign-ai.functions";
import { loadLeads, type LeadRecord } from "@/lib/leads";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/comunicacao")({
  head: () => ({
    meta: [
      { title: "Central de Comunicação — Atlas Platform" },
      {
        name: "description",
        content:
          "Feed de Notícias, Templates oficiais e Campanhas de relacionamento em um único módulo corporativo.",
      },
      { property: "og:title", content: "Central de Comunicação — Atlas Platform" },
      {
        property: "og:description",
        content: "Notícias corporativas, templates aprovados e campanhas de WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComunicacaoPage,
});

type Tab = "feed" | "templates" | "campanhas";

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const card =
  "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";
const field =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50";
const gold =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-4 py-2 text-xs text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40";
const ghost =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition";

function ComunicacaoPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [tab, setTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
  }, [navigate]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [n, t, c] = await Promise.all([listNews(), listTemplates(), listCampaigns()]);
      setPosts(n.posts);
      setTemplates(t.templates);
      setCampaigns(c.campaigns);
    } catch {
      setStatus("Não foi possível carregar a Central de Comunicação agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  const canPublish =
    session?.activeRole === "super_admin" || session?.activeRole === "diretora";

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Comunicação">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
            <Megaphone className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-xl">Comunicação corporativa</h1>
            <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
              Feed de Notícias, Templates oficiais da Meta e Campanhas de
              relacionamento — publicados uma única vez para todo o ecossistema.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 p-0.5">
          {(
            [
              ["feed", "Feed de Notícias"],
              ["templates", "Templates Meta"],
              ["campanhas", "Campanhas"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] transition",
                key === tab
                  ? "bg-[color:var(--gold)] text-[color:var(--navy-deep)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {status && (
        <p className="mb-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)]/40 px-4 py-2 text-xs text-[color:var(--muted-foreground)]">
          {status}
        </p>
      )}
      {loading && (
        <p className="mb-4 inline-flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </p>
      )}

      {tab === "feed" && (
        <FeedTab
          posts={posts}
          canPublish={Boolean(canPublish)}
          session={session}
          onChanged={refresh}
          onStatus={setStatus}
        />
      )}
      {tab === "templates" && (
        <TemplatesTab
          templates={templates}
          canPublish={Boolean(canPublish)}
          session={session}
          onChanged={refresh}
          onStatus={setStatus}
        />
      )}
      {tab === "campanhas" && (
        <CampaignsTab
          campaigns={campaigns}
          templates={templates}
          canPublish={Boolean(canPublish)}
          session={session}
          onChanged={refresh}
          onStatus={setStatus}
        />
      )}
    </ExecutiveShell>
  );
}

/* ------------------------------------------------------------- Feed */

function FeedTab({
  posts,
  canPublish,
  session,
  onChanged,
  onStatus,
}: {
  posts: NewsPost[];
  canPublish: boolean;
  session: ExecutiveSession;
  onChanged: () => Promise<void>;
  onStatus: (s: string | null) => void;
}) {
  const empty: NewsPost = useMemo(
    () => ({
      id: "",
      title: "",
      summary: "",
      body: "",
      imageUrl: "",
      videoUrl: "",
      audience: "todos",
      status: "rascunho",
      authorId: session.userId,
      authorName: session.name,
      createdAt: "",
      updatedAt: "",
    }),
    [session],
  );
  const [draft, setDraft] = useState<NewsPost>(empty);
  const [busy, setBusy] = useState(false);

  async function publish(status: NewsPost["status"]) {
    if (!draft.title.trim()) return onStatus("Informe um título para a notícia.");
    setBusy(true);
    try {
      const res = await saveNews({
        data: {
          actorId: session.userId,
          post: {
            ...draft,
            status,
            id: draft.id || uid("news"),
            authorId: session.userId,
            authorName: session.name,
          },
        },
      });
      if (!res.ok) onStatus("Seu perfil não tem permissão para publicar no Feed.");
      else {
        onStatus(status === "publicado" ? "Notícia publicada." : "Rascunho salvo.");
        setDraft(empty);
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        {posts.length === 0 && (
          <p className={cn(card, "text-sm text-[color:var(--muted-foreground)]")}>
            Nenhuma notícia publicada até o momento.
          </p>
        )}
        {posts.map((p) => (
          <article key={p.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base">{p.title}</h3>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {p.summary}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                  p.status === "publicado"
                    ? "border-[color:var(--gold)]/40 text-[color:var(--gold)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                )}
              >
                {p.status}
              </span>
            </div>
            {p.body && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
            )}
            {p.videoUrl && (
              <a
                href={p.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-[11px] text-[color:var(--gold)] underline"
              >
                Assistir ao vídeo
              </a>
            )}
            <div className="mt-4 flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
              <span>
                Público: {p.audience} · {p.authorName || "Equipe"}
              </span>
              {canPublish && (
                <button
                  type="button"
                  className={ghost}
                  onClick={async () => {
                    await deleteNews({ data: { actorId: session.userId, id: p.id } });
                    await onChanged();
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      {canPublish && (
        <aside className={cn(card, "space-y-3 self-start")}>
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="font-display text-sm">Nova notícia</h2>
          </div>
          <input
            className={field}
            placeholder="Título"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <input
            className={field}
            placeholder="Resumo"
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
          <textarea
            className={cn(field, "min-h-[140px]")}
            placeholder="Conteúdo"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <input
            className={field}
            placeholder="URL do vídeo (opcional)"
            value={draft.videoUrl ?? ""}
            onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
          />
          <select
            className={field}
            value={draft.audience}
            onChange={(e) =>
              setDraft({ ...draft, audience: e.target.value as NewsPost["audience"] })
            }
          >
            <option value="todos">Todos</option>
            <option value="executivos">Somente equipe</option>
            <option value="investidores">Somente investidores</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              className={gold}
              onClick={() => void publish("publicado")}
            >
              <Plus className="h-3.5 w-3.5" /> Publicar
            </button>
            <button
              type="button"
              disabled={busy}
              className={ghost}
              onClick={() => void publish("rascunho")}
            >
              Salvar rascunho
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

/* -------------------------------------------------------- Templates */

function TemplatesTab({
  templates,
  canPublish,
  session,
  onChanged,
  onStatus,
}: {
  templates: MetaTemplate[];
  canPublish: boolean;
  session: ExecutiveSession;
  onChanged: () => Promise<void>;
  onStatus: (s: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("MARKETING");

  async function save() {
    if (!name.trim() || !body.trim()) return onStatus("Informe nome e corpo do template.");
    const res = await saveTemplate({
      data: {
        actorId: session.userId,
        template: {
          id: uid("tpl"),
          name: name.trim(),
          language: "pt_BR",
          category,
          body: body.trim(),
          status: "pendente",
          createdBy: session.userId,
          createdAt: "",
        },
      },
    });
    if (!res.ok) return onStatus("Seu perfil não tem permissão para criar templates.");
    setName("");
    setBody("");
    onStatus("Template registrado. Envie para aprovação na Meta quando desejar.");
    await onChanged();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        {templates.length === 0 && (
          <p className={cn(card, "text-sm text-[color:var(--muted-foreground)]")}>
            Nenhum template cadastrado. Os disparos de campanha exigem um template
            aprovado pela Meta.
          </p>
        )}
        {templates.map((t) => (
          <article key={t.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base">{t.name}</h3>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  {t.category} · {t.language} · {t.status}
                </p>
              </div>
              {canPublish && (
                <button
                  type="button"
                  className={ghost}
                  onClick={async () => {
                    await deleteTemplate({ data: { actorId: session.userId, id: t.id } });
                    await onChanged();
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{t.body}</p>
          </article>
        ))}
      </section>

      {canPublish && (
        <aside className={cn(card, "space-y-3 self-start")}>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="font-display text-sm">Novo template</h2>
          </div>
          <input
            className={field}
            placeholder="Nome (ex.: velox_convite_reuniao)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className={field}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utilidade</option>
            <option value="AUTHENTICATION">Autenticação</option>
          </select>
          <textarea
            className={cn(field, "min-h-[160px]")}
            placeholder="Corpo da mensagem. Use {{1}} para o primeiro nome."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="button" className={gold} onClick={() => void save()}>
            <Plus className="h-3.5 w-3.5" /> Registrar template
          </button>
        </aside>
      )}
    </div>
  );
}

/* -------------------------------------------------------- Campanhas */

function CampaignsTab({
  campaigns,
  templates,
  canPublish,
  session,
  onChanged,
  onStatus,
}: {
  campaigns: Campaign[];
  templates: MetaTemplate[];
  canPublish: boolean;
  session: ExecutiveSession;
  onChanged: () => Promise<void>;
  onStatus: (s: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [intent, setIntent] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const audience = useMemo(
    () =>
      loadLeads()
        .filter((l: LeadRecord) => Boolean(l.whatsapp))
        .map((l: LeadRecord) => ({ phone: l.whatsapp, name: l.name })),
    [],
  );

  async function runAi() {
    if (!intent.trim()) return onStatus("Descreva a intenção da campanha.");
    setAiBusy(true);
    try {
      const draft = await generateCampaignDraft({ data: { intent: intent.trim() } });
      if (draft.name) setName(draft.name);
      if (draft.objective) setObjective(draft.objective);
      if (draft.templateBody) {
        await saveTemplate({
          data: {
            actorId: session.userId,
            template: {
              id: uid("tpl"),
              name: `ia_${Date.now().toString(36)}`,
              language: "pt_BR",
              category: "MARKETING",
              body: draft.templateBody,
              status: "pendente",
              createdBy: session.userId,
              createdAt: "",
            },
          },
        });
        await onChanged();
      }
      onStatus(draft.notes || "Rascunho gerado. Revise antes de qualquer disparo.");
    } finally {
      setAiBusy(false);
    }
  }

  async function create() {
    if (!name.trim()) return onStatus("Informe o nome da campanha.");
    const res = await saveCampaign({
      data: {
        actorId: session.userId,
        campaign: {
          id: uid("cmp"),
          name: name.trim(),
          objective: objective.trim(),
          templateId: templateId || null,
          audience: "carteira",
          status: "rascunho",
          sentCount: 0,
          failedCount: 0,
          repliedCount: 0,
          createdBy: session.userId,
          createdByName: session.name,
          createdAt: "",
        },
      },
    });
    if (!res.ok) return onStatus("Seu perfil não tem permissão para criar campanhas.");
    setName("");
    setObjective("");
    onStatus("Campanha criada como rascunho.");
    await onChanged();
  }

  async function dispatch(c: Campaign) {
    if (audience.length === 0) return onStatus("Nenhum investidor com WhatsApp na base.");
    setSending(c.id);
    try {
      const res = await dispatchCampaignNow({
        data: { actorId: session.userId, campaignId: c.id, recipients: audience },
      });
      if (!res.ok) onStatus("Seu perfil não tem permissão para disparar campanhas.");
      else onStatus(`Disparo concluído: ${res.sent} enviadas, ${res.failed} falhas.`);
      await onChanged();
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        {campaigns.length === 0 && (
          <p className={cn(card, "text-sm text-[color:var(--muted-foreground)]")}>
            Nenhuma campanha registrada.
          </p>
        )}
        {campaigns.map((c) => (
          <article key={c.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base">{c.name}</h3>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {c.objective || "Sem objetivo declarado."}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                {c.status}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ["Enviadas", c.sentCount],
                ["Falhas", c.failedCount],
                ["Respostas", c.repliedCount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-[color:var(--border)] py-2"
                >
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                    {label}
                  </dt>
                  <dd className="font-display text-lg text-[color:var(--gold)]">{value}</dd>
                </div>
              ))}
            </dl>
            {canPublish && (
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={sending === c.id}
                  className={gold}
                  onClick={() => void dispatch(c)}
                >
                  {sending === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Disparar para a base ({audience.length})
                </button>
                <button
                  type="button"
                  className={ghost}
                  onClick={async () => {
                    await deleteCampaign({ data: { actorId: session.userId, id: c.id } });
                    await onChanged();
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              </div>
            )}
          </article>
        ))}
      </section>

      {canPublish && (
        <aside className="space-y-6 self-start">
          <div className={cn(card, "space-y-3")}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
              <h2 className="font-display text-sm">IA de campanhas</h2>
            </div>
            <textarea
              className={cn(field, "min-h-[100px]")}
              placeholder="Ex.: retomar contato com investidores que pararam no capítulo de investimento."
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            />
            <button
              type="button"
              disabled={aiBusy}
              className={gold}
              onClick={() => void runAi()}
            >
              {aiBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Gerar rascunho
            </button>
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              A IA apenas sugere. Nada é enviado sem revisão humana.
            </p>
          </div>

          <div className={cn(card, "space-y-3")}>
            <h2 className="font-display text-sm">Nova campanha</h2>
            <input
              className={field}
              placeholder="Nome da campanha"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className={cn(field, "min-h-[80px]")}
              placeholder="Objetivo"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
            <select
              className={field}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Template (opcional)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button type="button" className={gold} onClick={() => void create()}>
              <Plus className="h-3.5 w-3.5" /> Criar campanha
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}