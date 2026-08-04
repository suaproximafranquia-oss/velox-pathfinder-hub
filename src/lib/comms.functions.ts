/**
 * Bloco 5 — Comunicação (Feed de Notícias, Templates Meta, Campanhas).
 *
 * Tudo vive na nuvem: o que a Gestora publica aparece imediatamente para
 * toda a equipe e, quando o público inclui investidores, também no Portal.
 * Administradores e Gestores publicam; Colaboradores apenas consultam.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NewsAudience = "todos" | "executivos" | "investidores";
export type NewsStatus = "rascunho" | "publicado";

export type NewsPost = {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  audience: NewsAudience;
  status: NewsStatus;
  authorId: string;
  authorName: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  body: string;
  status: "aprovado" | "pendente" | "reprovado";
  createdBy: string;
  createdAt: string;
};

export type Campaign = {
  id: string;
  name: string;
  objective: string;
  templateId: string | null;
  audience: string;
  status: "rascunho" | "agendada" | "enviada";
  scheduledAt?: string | null;
  sentCount: number;
  failedCount: number;
  repliedCount: number;
  createdBy: string;
  createdByName: string;
  lastDispatchAt?: string | null;
  createdAt: string;
};

/** Perfis autorizados a publicar (Administrador e Gestora). */
const EDITORS = new Set(["usr_thiago", "usr_larissa"]);

/* -------------------------------------------------------------- Feed */

function toPost(row: Record<string, unknown>): NewsPost {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    body: String(row.body ?? ""),
    imageUrl: (row.image_url as string | null) ?? null,
    videoUrl: (row.video_url as string | null) ?? null,
    audience: (row.audience as NewsAudience) ?? "todos",
    status: (row.status as NewsStatus) ?? "rascunho",
    authorId: String(row.author_id ?? ""),
    authorName: String(row.author_name ?? ""),
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export const listNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("news_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { posts: (data ?? []).map((r) => toPost(r as Record<string, unknown>)) };
  });

/**
 * Feed público do Portal: investidores não são usuários autenticados da
 * plataforma, então só recebem notícias publicadas para o público deles.
 */
export const listInvestorNews = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("news_posts")
    .select("id, title, summary, body, image_url, video_url, published_at, audience, status")
    .eq("status", "publicado")
    .in("audience", ["todos", "investidores"])
    .order("published_at", { ascending: false })
    .limit(12);
  if (error) return { posts: [] as NewsPost[] };
  return { posts: (data ?? []).map((r) => toPost(r as Record<string, unknown>)) };
});

export const saveNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; post: NewsPost }) => data)
  .handler(async ({ data }) => {
    if (!EDITORS.has(data.actorId)) return { ok: false as const, reason: "sem-permissao" };
    const p = data.post;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("news_posts").upsert({
      id: p.id,
      title: p.title,
      summary: p.summary,
      body: p.body,
      image_url: p.imageUrl ?? null,
      video_url: p.videoUrl ?? null,
      audience: p.audience,
      status: p.status,
      author_id: p.authorId,
      author_name: p.authorName,
      published_at:
        p.status === "publicado" ? (p.publishedAt ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; id: string }) => data)
  .handler(async ({ data }) => {
    if (!EDITORS.has(data.actorId)) return { ok: false as const, reason: "sem-permissao" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("news_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* --------------------------------------------------------- Templates */

function toTemplate(row: Record<string, unknown>): MetaTemplate {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    language: String(row.language ?? "pt_BR"),
    category: String(row.category ?? "MARKETING"),
    body: String(row.body ?? ""),
    status: (row.status as MetaTemplate["status"]) ?? "pendente",
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("meta_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { templates: (data ?? []).map((r) => toTemplate(r as Record<string, unknown>)) };
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; template: MetaTemplate }) => data)
  .handler(async ({ data }) => {
    if (!EDITORS.has(data.actorId)) return { ok: false as const, reason: "sem-permissao" };
    const t = data.template;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("meta_templates").upsert({
      id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      body: t.body,
      status: t.status,
      created_by: t.createdBy,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; id: string }) => data)
  .handler(async ({ data }) => {
    if (!EDITORS.has(data.actorId)) return { ok: false as const, reason: "sem-permissao" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("meta_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* --------------------------------------------------------- Campanhas */

function toCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    objective: String(row.objective ?? ""),
    templateId: (row.template_id as string | null) ?? null,
    audience: String(row.audience ?? "todos"),
    status: (row.status as Campaign["status"]) ?? "rascunho",
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    sentCount: Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    repliedCount: Number(row.replied_count ?? 0),
    createdBy: String(row.created_by ?? ""),
    createdByName: String(row.created_by_name ?? ""),
    lastDispatchAt: (row.last_dispatch_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { campaigns: (data ?? []).map((r) => toCampaign(r as Record<string, unknown>)) };
  });

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; campaign: Campaign }) => data)
  .handler(async ({ data }) => {
    if (!EDITORS.has(data.actorId)) return { ok: false as const, reason: "sem-permissao" };
    const c = data.campaign;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("campaigns").upsert({
      id: c.id,
      name: c.name,
      objective: c.objective,
      template_id: c.templateId,
      audience: c.audience,
      status: c.status,
      scheduled_at: c.scheduledAt ?? null,
      sent_count: c.sentCount,
      failed_count: c.failedCount,
      replied_count: c.repliedCount,
      created_by: c.createdBy,
      created_by_name: c.createdByName,
      last_dispatch_at: c.lastDispatchAt ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; id: string }) => data)
  .handler(async ({ data }) => {
    if (!EDITORS.has(data.actorId)) return { ok: false as const, reason: "sem-permissao" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Disparo oficial: só o canal do CRM envia mensagens. O resultado volta
 * consolidado e é gravado na própria campanha (estatísticas).
 */
export const dispatchCampaignNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      actorId: string;
      campaignId: string;
      recipients: { phone: string; name: string }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!EDITORS.has(data.actorId)) {
      return { ok: false as const, reason: "sem-permissao", sent: 0, failed: 0 };
    }
    const { dispatchCampaign } = await import("@/server/campaigns.server");
    const result = await dispatchCampaign({
      recipients: data.recipients,
      campaignId: data.campaignId,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("campaigns")
      .select("sent_count, failed_count")
      .eq("id", data.campaignId)
      .maybeSingle();
    await supabaseAdmin
      .from("campaigns")
      .update({
        status: "enviada",
        sent_count: Number(current?.sent_count ?? 0) + result.sent,
        failed_count: Number(current?.failed_count ?? 0) + result.failed,
        last_dispatch_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.campaignId);
    return { ok: true as const, ...result };
  });