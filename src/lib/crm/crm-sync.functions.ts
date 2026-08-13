import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Persistência server-side do CRM (mensagens e Timeline).
 *
 * O navegador passa a ser apenas interface: toda mensagem e toda
 * ocorrência da Timeline é gravada no banco e lida de volta por qualquer
 * computador autorizado. O armazenamento local permanece somente como
 * cache de apresentação, nunca como fonte de verdade.
 */
const messageSchema = z.object({
  id: z.string().min(3),
  investorId: z.string().min(3),
  direction: z.enum(["enviada", "recebida"]),
  body: z.string(),
  at: z.string(),
  authorId: z.string(),
  authorName: z.string().optional().nullable(),
});

const timelineSchema = z.object({
  id: z.string().min(3),
  investorId: z.string().min(3),
  event: z.string(),
  origin: z.string(),
  reason: z.string(),
  ownerId: z.string().optional().nullable(),
  actorId: z.string().optional().nullable(),
  at: z.string(),
});

const batchSchema = z.object({
  messages: z.array(messageSchema).max(500).default([]),
  timeline: z.array(timelineSchema).max(500).default([]),
});

type Batch = z.infer<typeof batchSchema>;

function messageRows(batch: Batch) {
  return batch.messages.map((m) => ({
    id: m.id,
    investor_id: m.investorId,
    direction: m.direction,
    body: m.body,
    at: m.at,
    author_id: m.authorId,
    author_name: m.authorName ?? null,
  }));
}

function timelineRows(batch: Batch) {
  return batch.timeline.map((t) => ({
    id: t.id,
    investor_id: t.investorId,
    event: t.event,
    origin: t.origin,
    reason: t.reason,
    owner_id: t.ownerId ?? null,
    actor_id: t.actorId ?? null,
    at: t.at,
  }));
}

/** Gravação feita pelo Workspace/CRM — exige usuário autenticado. */
export const pushCrmRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => batchSchema.parse(data))
  .handler(async ({ data, context }) => {
    const msgs = messageRows(data);
    const tl = timelineRows(data);
    if (msgs.length) {
      await context.supabase.from("crm_messages").upsert(msgs, { onConflict: "id", ignoreDuplicates: true });
    }
    if (tl.length) {
      await context.supabase.from("crm_timeline").upsert(tl, { onConflict: "id", ignoreDuplicates: true });
    }
    return { ok: true as const, messages: msgs.length, timeline: tl.length };
  });

/**
 * Gravação originada no navegador do investidor (abertura de jornada).
 * Exige o token assinado do próprio investidor e só aceita registros
 * daquele investidor — nunca de terceiros.
 */
export const pushPortalCrmRecords = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    batchSchema.extend({ investorId: z.string().min(3), token: z.string().min(10) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyToken } = await import("@/server/portal-token.server");
    if (!(await verifyToken(data.token, data.investorId))) {
      return { ok: false as const, reason: "nao_autorizado" };
    }
    const scoped: Batch = {
      messages: data.messages.filter((m) => m.investorId === data.investorId),
      timeline: data.timeline.filter((t) => t.investorId === data.investorId),
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const msgs = messageRows(scoped);
    const tl = timelineRows(scoped);
    if (msgs.length) {
      await supabaseAdmin.from("crm_messages").upsert(msgs, { onConflict: "id", ignoreDuplicates: true });
    }
    if (tl.length) {
      await supabaseAdmin.from("crm_timeline").upsert(tl, { onConflict: "id", ignoreDuplicates: true });
    }
    return { ok: true as const };
  });

/** Leitura oficial — o histórico completo, independente do navegador. */
export const pullCrmRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ investorId: z.string().min(3).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    let messagesQuery = context.supabase
      .from("crm_messages")
      .select("id,investor_id,direction,body,at,author_id,author_name")
      .order("at", { ascending: false })
      .limit(2000);
    let timelineQuery = context.supabase
      .from("crm_timeline")
      .select("id,investor_id,event,origin,reason,owner_id,actor_id,at")
      .order("at", { ascending: false })
      .limit(2000);
    if (data.investorId) {
      messagesQuery = messagesQuery.eq("investor_id", data.investorId);
      timelineQuery = timelineQuery.eq("investor_id", data.investorId);
    }
    const [messages, timeline] = await Promise.all([messagesQuery, timelineQuery]);
    if (messages.error) throw new Error(messages.error.message);
    if (timeline.error) throw new Error(timeline.error.message);
    return { messages: messages.data ?? [], timeline: timeline.data ?? [] };
  });
