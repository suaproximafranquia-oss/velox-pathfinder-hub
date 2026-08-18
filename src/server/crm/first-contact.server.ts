/**
 * PRIMEIRO CONTATO DO LEAD NOVO — registro interno obrigatório.
 *
 * A entrega externa pelo WhatsApp/Meta pode estar temporariamente
 * indisponível. Isso NUNCA interrompe a lógica interna: a regra é
 * acionada, o texto oficial é resolvido com as variáveis do lead, a
 * mensagem é registrada no CRM e o evento aparece no histórico. Quando o
 * canal oficial existir, a MESMA lógica passa a entregar de fato.
 *
 * A operação é idempotente: um lead recebe primeiro contato uma única vez.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildWelcomeMessage, loadSettings } from "@/server/crm/automation.server";
import { sendWhatsappText } from "@/server/crm/messaging.server";

export type FirstContactInput = {
  leadId: string;
  name: string;
  phone: string;
  origin: string;
  ownerId: string | null;
  executiveName?: string | null;
  executiveSlug?: string | null;
};

export type FirstContactResult =
  | { registered: false; reason: string }
  | { registered: true; delivered: boolean; error?: string };

export async function registerFirstContact(
  input: FirstContactInput,
): Promise<FirstContactResult> {
  const messageId = `msg_e0_${input.leadId}`;
  const { data: existing } = await supabaseAdmin
    .from("crm_messages")
    .select("id")
    .eq("id", messageId)
    .maybeSingle();
  if (existing) return { registered: false, reason: "primeiro contato já registrado" };

  const settings = await loadSettings();
  if (!settings.welcomeEnabled) return { registered: false, reason: "boas-vindas desativadas" };

  const message = buildWelcomeMessage(settings, input.name, {
    name: input.executiveName ?? null,
    slug: input.executiveSlug ?? null,
  });
  const at = new Date().toISOString();

  await supabaseAdmin.from("crm_messages").insert({
    id: messageId,
    investor_id: input.leadId,
    direction: "enviada",
    body: message.body,
    author_id: input.ownerId ?? "sistema",
    author_name: "Primeiro contato",
    at,
  });

  // A entrega externa é tentada; o resultado é registrado, jamais
  // impede o registro interno nem a continuidade da cadência.
  const delivery = await sendWhatsappText({ phone: input.phone, body: message.body });

  await supabaseAdmin.from("crm_timeline").insert({
    id: `tl_e0_${input.leadId}`,
    investor_id: input.leadId,
    event: "primeiro_contato",
    origin: input.origin,
    reason: delivery.delivered
      ? "Primeiro contato enviado pelo canal oficial."
      : `Primeiro contato processado e registrado. Entrega externa pendente: ${delivery.error ?? "canal indisponível"}.`,
    owner_id: input.ownerId,
    actor_id: "sistema",
    at,
  });

  return { registered: true, delivered: delivery.delivered, error: delivery.error };
}
