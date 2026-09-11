/**
 * MENSAGEM RECEBIDA DO INVESTIDOR — CAMINHO ÚNICO (SERVER ONLY).
 *
 * Este módulo é o elo entre o webhook oficial da Meta e o Motor de
 * Relacionamento. Ele NÃO cria um segundo motor de resposta: usa a
 * decisão que já existe (`decideAutoReply`), o texto que já existe
 * (Biblioteca) e o snapshot que já existe (`recordMessageSnapshot`).
 *
 * Ordem obrigatória de decisão:
 *   1. identificar o lead pelo telefone real;
 *   2. registrar a mensagem recebida (idempotente pelo id da Meta);
 *   3. resolver o executivo responsável;
 *   4. validar a JANELA DE 24H da Meta (texto livre x template);
 *   5. perguntar ao motor se a resposta automática é permitida;
 *   6. usar o conteúdo oficial da Biblioteca;
 *   7. registrar envio + snapshot, com a marca estruturada de simulação.
 *
 * Homologação/lead de teste NUNCA chega à Meta: a decisão de ambiente
 * acontece antes de qualquer credencial.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { onlyDigits } from "@/server/whatsapp.server";
import { resolveMetaWindow, type MetaWindowDecision } from "@/lib/relationship/meta-window";
import { decideAutoReply } from "./auto-reply.server";
import { executionMode } from "./execution-mode.server";
import { prepareStepMessage } from "./step-message.server";
import { recordMessageSnapshot } from "./message-library.server";
import { sendWhatsappText } from "@/server/crm/messaging.server";

/**
 * A resposta automática tem ETAPA PRÓPRIA na Biblioteca. Ela não toma
 * mais emprestado o texto de uma etapa de cadência (R1): aquilo fazia a
 * orientação da janela de 24h se confundir com o relacionamento
 * planejado e contaminava o histórico. Sem texto oficial publicado, o
 * motor não responde — e diz por quê.
 */
import { AUTO_REPLY_STEP } from "./message-library.server";

export type InboundMessage = {
  /** `wamid` da Meta — chave de idempotência do registro. */
  externalId: string | null;
  phone: string;
  body: string;
  at: string;
};

export function parseInboundMessage(payload: unknown): InboundMessage | null {
  try {
    const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message?.from) return null;
    const text =
      message.text?.body ??
      message.button?.text ??
      message.interactive?.button_reply?.title ??
      `[${message.type ?? "mensagem"}]`;
    const ts = Number(message.timestamp);
    return {
      externalId: message.id ? String(message.id) : null,
      phone: onlyDigits(String(message.from)),
      body: String(text),
      at: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export type InboundLead = { id: string; name: string | null; isTest: boolean };

/** Identidade do lead pelo telefone real, sem inventar cadastro novo. */
export async function findLeadByPhone(phone: string): Promise<InboundLead | null> {
  const digits = onlyDigits(phone);
  if (digits.length < 8) return null;
  const tail = digits.slice(-8);
  const { data } = await supabaseAdmin
    .from("portal_leads")
    .select("id,name,whatsapp,is_test,created_at")
    .ilike("whatsapp", `%${tail}%`)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as Record<string, any>[];
  const match = rows.find((row) => onlyDigits(String(row["whatsapp"] ?? "")).endsWith(tail));
  if (!match) return null;
  return {
    id: String(match["id"]),
    name: match["name"] ?? null,
    isTest: Boolean(match["is_test"]),
  };
}

/** Última mensagem RECEBIDA do investidor — base da janela de 24h. */
export async function lastInboundAt(leadId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("crm_messages")
    .select("at")
    .eq("investor_id", leadId)
    .eq("direction", "recebida")
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Record<string, any> | null)?.["at"] ?? null;
}

export type InboundOutcome = {
  handled: boolean;
  leadId: string | null;
  /** Registro da mensagem recebida foi criado nesta execução. */
  recorded: boolean;
  window: MetaWindowDecision | null;
  autoReply:
    | { sent: false; reason: string }
    | { sent: true; simulated: boolean; body: string; reason: string };
};

export async function handleInboundMessage(message: InboundMessage): Promise<InboundOutcome> {
  const lead = await findLeadByPhone(message.phone);
  if (!lead) {
    return {
      handled: false,
      leadId: null,
      recorded: false,
      window: null,
      autoReply: { sent: false, reason: "Telefone sem lead correspondente no Portal." },
    };
  }

  /**
   * A janela é calculada ANTES de gravar a mensagem atual: quem abre a
   * conversa é o investidor, e o instante desta mensagem é o novo
   * início. Registrar primeiro faria toda mensagem parecer "dentro".
   */
  const previousInbound = await lastInboundAt(lead.id);
  const window = resolveMetaWindow({ lastInboundAt: message.at, nowIso: message.at });

  const messageId = message.externalId
    ? `msg_in_${message.externalId}`
    : `msg_in_${lead.id}_${new Date(message.at).getTime()}`;
  const { error: insertError } = await supabaseAdmin.from("crm_messages").insert({
    id: messageId,
    investor_id: lead.id,
    direction: "recebida",
    body: message.body,
    author_id: "investidor",
    author_name: lead.name ?? "Investidor",
    at: message.at,
    simulated: false,
  } as any);
  // Reentrega do mesmo webhook não cria uma segunda mensagem.
  if (insertError && insertError.code === "23505") {
    return {
      handled: true,
      leadId: lead.id,
      recorded: false,
      window,
      autoReply: { sent: false, reason: "Mensagem já registrada (reentrega do webhook)." },
    };
  }

  if (!window.open) {
    return {
      handled: true,
      leadId: lead.id,
      recorded: true,
      window,
      autoReply: { sent: false, reason: window.reason },
    };
  }

  const decision = await decideAutoReply(lead.id);
  if (!decision.send) {
    return {
      handled: true,
      leadId: lead.id,
      recorded: true,
      window,
      autoReply: { sent: false, reason: decision.reason },
    };
  }

  const prepared = await prepareStepMessage({
    leadId: lead.id,
    step: AUTO_REPLY_STEP,
    leadName: lead.name,
  });
  if (!prepared.body) {
    return {
      handled: true,
      leadId: lead.id,
      recorded: true,
      window,
      autoReply: {
        sent: false,
        reason: prepared.blockedReason ?? "Sem conteúdo oficial para resposta automática.",
      },
    };
  }

  const simulated = executionMode({ isTestLead: lead.isTest }).simulated;
  const at = new Date().toISOString();
  const replyId = `msg_auto_${messageId}`;
  const { error: replyError } = await supabaseAdmin.from("crm_messages").insert({
    id: replyId,
    investor_id: lead.id,
    direction: "enviada",
    body: prepared.body,
    author_id: "sistema",
    author_name: "Resposta automática",
    at,
    simulated,
  } as any);
  if (replyError && replyError.code === "23505") {
    return {
      handled: true,
      leadId: lead.id,
      recorded: true,
      window,
      autoReply: { sent: false, reason: "Resposta automática já registrada." },
    };
  }

  await recordMessageSnapshot({
    leadId: lead.id,
    step: AUTO_REPLY_STEP,
    renderedBody: prepared.body,
    templateBody: prepared.body,
    libraryVersion: prepared.libraryVersion,
    investorNameUsed: prepared.investorNameUsed,
    actorName: "Resposta automática",
    origin: "motor",
    messageId: replyId,
    contentUrl: prepared.contentUrl,
    simulated,
    sentAt: at,
  });

  // AMBIENTE ANTES DE CREDENCIAL: homologação/lead de teste não chama a Meta.
  if (!simulated) {
    await sendWhatsappText({ phone: message.phone, body: prepared.body });
  }

  return {
    handled: true,
    leadId: lead.id,
    recorded: true,
    window,
    autoReply: {
      sent: true,
      simulated,
      body: prepared.body,
      reason: previousInbound
        ? "Resposta automática dentro da janela de 24h."
        : "Primeira mensagem do investidor: janela aberta.",
    },
  };
}
