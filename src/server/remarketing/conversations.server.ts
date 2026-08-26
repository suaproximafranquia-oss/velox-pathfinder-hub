/**
 * Caixa de Conversas do Remarketing — ambiente isolado.
 *
 * ISOLAMENTO ABSOLUTO: nada aqui cria lead, card, etapa, cadência ou
 * evento no CRM de Relacionamento. As conversas vivem exclusivamente
 * em `remarketing_conversations` / `remarketing_messages` e são
 * identificadas pelo telefone normalizado.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { channelMode, onlyDigits, sendTextMessage } from "@/server/whatsapp.server";
import type {
  RemarketingConversation,
  RemarketingConversationStatus,
  RemarketingMessage,
} from "@/lib/remarketing/types";

type Row = Record<string, unknown>;

function toConversation(row: Row): RemarketingConversation {
  return {
    id: String(row["id"]),
    phone: String(row["phone"] ?? ""),
    contactName: (row["contact_name"] as string | null) ?? null,
    campaignId: (row["campaign_id"] as string | null) ?? null,
    campaignName: (row["campaign_name"] as string | null) ?? null,
    status: String(row["status"] ?? "aguardando") as RemarketingConversationStatus,
    lastMessageAt: String(row["last_message_at"] ?? ""),
    lastMessagePreview: String(row["last_message_preview"] ?? ""),
    lastDirection: (String(row["last_direction"] ?? "saida") as "saida" | "entrada"),
    unreadCount: Number(row["unread_count"] ?? 0),
    createdAt: String(row["created_at"] ?? ""),
  };
}

function toMessage(row: Row): RemarketingMessage {
  return {
    id: String(row["id"]),
    conversationId: String(row["conversation_id"]),
    campaignId: (row["campaign_id"] as string | null) ?? null,
    direction: String(row["direction"] ?? "saida") as "saida" | "entrada",
    kind: String(row["kind"] ?? "texto") as RemarketingMessage["kind"],
    body: String(row["body"] ?? ""),
    templateName: (row["template_name"] as string | null) ?? null,
    authorName: (row["author_name"] as string | null) ?? null,
    delivered: Boolean(row["delivered"] ?? true),
    error: (row["error"] as string | null) ?? null,
    simulated: Boolean(row["simulated"] ?? false),
    occurredAt: String(row["occurred_at"] ?? ""),
  };
}

/** Garante a conversa do número, sem jamais tocar o CRM de Relacionamento. */
export async function ensureConversation(input: {
  phone: string;
  campaignId?: string | null;
  campaignName?: string | null;
  contactName?: string | null;
}): Promise<RemarketingConversation | null> {
  const phone = onlyDigits(input.phone);
  if (phone.length < 10) return null;

  const { data: existing } = await supabaseAdmin
    .from("remarketing_conversations")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  if (existing) return toConversation(existing as Row);

  const { data, error } = await supabaseAdmin
    .from("remarketing_conversations")
    .insert({
      phone,
      campaign_id: input.campaignId ?? null,
      campaign_name: input.campaignName ?? null,
      contact_name: input.contactName ?? null,
      status: "aguardando",
    })
    .select("*")
    .single();
  if (error) {
    // Corrida entre dois envios do mesmo número: relê o registro.
    const { data: again } = await supabaseAdmin
      .from("remarketing_conversations")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    return again ? toConversation(again as Row) : null;
  }
  return toConversation(data as Row);
}

async function appendMessage(input: {
  conversationId: string;
  campaignId?: string | null;
  direction: "saida" | "entrada";
  kind: RemarketingMessage["kind"];
  body: string;
  templateName?: string | null;
  authorName?: string | null;
  delivered?: boolean;
  error?: string | null;
  simulated?: boolean;
  status?: RemarketingConversationStatus;
  /** SNAPSHOT: versão/rótulo/idioma da campanha no instante do envio. */
  campaignVersion?: number | null;
  templateLabel?: string | null;
  templateLanguage?: string | null;
}): Promise<RemarketingMessage> {
  const occurredAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("remarketing_messages")
    .insert({
      conversation_id: input.conversationId,
      campaign_id: input.campaignId ?? null,
      direction: input.direction,
      kind: input.kind,
      body: input.body,
      template_name: input.templateName ?? null,
      campaign_version: input.campaignVersion ?? null,
      template_label: input.templateLabel ?? null,
      template_language: input.templateLanguage ?? null,
      author_name: input.authorName ?? null,
      delivered: input.delivered ?? true,
      error: input.error ?? null,
      simulated: input.simulated ?? false,
      occurred_at: occurredAt,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const patch: {
    last_message_at: string;
    last_message_preview: string;
    last_direction: string;
    status?: string;
    unread_count?: number;
  } = {
    last_message_at: occurredAt,
    last_message_preview: input.body.slice(0, 160),
    last_direction: input.direction,
  };
  if (input.status) patch.status = input.status;

  if (input.direction === "entrada") {
    const { data: current } = await supabaseAdmin
      .from("remarketing_conversations")
      .select("unread_count")
      .eq("id", input.conversationId)
      .maybeSingle();
    patch.unread_count = Number((current as Row | null)?.["unread_count"] ?? 0) + 1;
  }
  await supabaseAdmin
    .from("remarketing_conversations")
    .update(patch)
    .eq("id", input.conversationId);

  return toMessage(data as Row);
}

/** Registro do disparo da campanha na caixa de conversas. */
export async function recordCampaignDispatch(input: {
  phone: string;
  campaignId: string;
  campaignName: string;
  templateName: string;
  templateBody: string;
  delivered: boolean;
  error?: string | null;
  simulated: boolean;
  campaignVersion?: number | null;
  templateLabel?: string | null;
  templateLanguage?: string | null;
}): Promise<void> {
  const conversation = await ensureConversation({
    phone: input.phone,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
  });
  if (!conversation) return;
  await appendMessage({
    conversationId: conversation.id,
    campaignId: input.campaignId,
    direction: "saida",
    kind: "template",
    body: input.templateBody || input.templateName,
    templateName: input.templateName,
    authorName: input.campaignName,
    delivered: input.delivered,
    error: input.error ?? null,
    simulated: input.simulated,
    /**
     * SNAPSHOT DO REMARKETING: o corpo gravado é o que realmente saiu, e
     * a versão da campanha fica congelada nesta linha. Editar a campanha
     * depois cria uma nova versão e NÃO reescreve este histórico.
     */
    campaignVersion: input.campaignVersion ?? null,
    templateLabel: input.templateLabel ?? null,
    templateLanguage: input.templateLanguage ?? null,
  });
}

export async function listConversations(): Promise<RemarketingConversation[]> {
  const { data, error } = await supabaseAdmin
    .from("remarketing_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toConversation);
}

export async function listMessages(conversationId: string): Promise<RemarketingMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("remarketing_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("occurred_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toMessage);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await supabaseAdmin
    .from("remarketing_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
}

export async function setConversationStatus(
  conversationId: string,
  status: RemarketingConversationStatus,
): Promise<void> {
  await supabaseAdmin
    .from("remarketing_conversations")
    .update({ status })
    .eq("id", conversationId);
}

export async function renameConversation(
  conversationId: string,
  contactName: string,
): Promise<void> {
  await supabaseAdmin
    .from("remarketing_conversations")
    .update({ contact_name: contactName || null })
    .eq("id", conversationId);
}

/** Resposta manual do operador — texto livre pelo canal ativo. */
export async function replyManually(input: {
  conversationId: string;
  body: string;
  authorName: string;
}): Promise<RemarketingMessage> {
  const { data } = await supabaseAdmin
    .from("remarketing_conversations")
    .select("phone")
    .eq("id", input.conversationId)
    .maybeSingle();
  const phone = String((data as Row | null)?.["phone"] ?? "");
  if (!phone) throw new Error("Conversa não encontrada.");

  const simulated = channelMode() === "simulator";
  const result = await sendTextMessage({ phone, body: input.body });
  return appendMessage({
    conversationId: input.conversationId,
    direction: "saida",
    kind: "texto",
    body: input.body,
    authorName: input.authorName,
    delivered: result.delivered,
    error: result.error ?? null,
    simulated,
    status: "em_atendimento",
  });
}

/** Mensagem recebida — vinda do Webhook oficial ou da simulação. */
export async function recordInbound(input: {
  phone: string;
  body: string;
  simulated?: boolean;
}): Promise<RemarketingMessage | null> {
  const phone = onlyDigits(input.phone);
  const { data } = await supabaseAdmin
    .from("remarketing_conversations")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  const conversationId = (data as Row | null)?.["id"];
  if (!conversationId) return null;
  return appendMessage({
    conversationId: String(conversationId),
    direction: "entrada",
    kind: "texto",
    body: input.body,
    delivered: true,
    simulated: input.simulated ?? false,
    status: "respondeu",
  });
}

/** true quando o número pertence ao ambiente de Remarketing. */
export async function isRemarketingPhone(phone: string): Promise<boolean> {
  const digits = onlyDigits(phone);
  if (digits.length < 10) return false;
  const { data } = await supabaseAdmin
    .from("remarketing_conversations")
    .select("id")
    .eq("phone", digits)
    .maybeSingle();
  return Boolean(data);
}

/** Extrai telefone + texto de um payload de Webhook da Meta. */
export function parseInboundText(payload: unknown): { phone: string; body: string } | null {
  try {
    const body = payload as {
      entry?: {
        changes?: {
          value?: {
            messages?: {
              from?: string;
              type?: string;
              text?: { body?: string };
              button?: { text?: string };
              interactive?: { button_reply?: { title?: string } };
            }[];
          };
        }[];
      }[];
    };
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message?.from) return null;
    const text =
      message.text?.body ??
      message.button?.text ??
      message.interactive?.button_reply?.title ??
      `[${message.type ?? "mensagem"}]`;
    return { phone: onlyDigits(message.from), body: String(text) };
  } catch {
    return null;
  }
}
