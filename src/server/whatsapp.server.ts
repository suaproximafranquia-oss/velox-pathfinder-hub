/**
 * DEF 3.0.2 §3 e §5 — canal oficial do CRM com a WhatsApp Cloud API.
 *
 * O Portal NUNCA conversa com o WhatsApp: quem envia o Template Oficial
 * é exclusivamente o CRM, através deste módulo de servidor. As respostas
 * do investidor chegam pelo Webhook da Meta e ficam registradas na base
 * oficial de validações.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ValidationStatus = "enviado" | "confirmado" | "recusado";

export type ValidationRow = {
  phone: string;
  journeyId: string | null;
  status: ValidationStatus;
  respondedAt: string | null;
};

export function onlyDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

const TEMPLATE_NAME = "velox_validacao_identidade";

/* ---------------------------------------------------------------------
 * Adaptador de canal — provider interno x Meta oficial.
 *
 * A arquitetura inteira funciona sem credenciais: o provider interno
 * ("mock") registra o envio na base oficial de validações e mantém o
 * fluxo completo (Jornada Digital → bloqueio → confirmação → CRM). No
 * momento em que WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID existirem, o
 * provider oficial da Meta assume automaticamente, sem qualquer mudança
 * nos pontos de chamada.
 * ------------------------------------------------------------------ */

export type ChannelProviderId = "interno" | "meta";

export type TemplateDispatch = {
  ok: boolean;
  provider: ChannelProviderId;
  delivered: boolean;
  error?: string;
};

type TemplateInput = { phone: string; investorName: string; journeyId: string };

type ChannelProvider = {
  id: ChannelProviderId;
  send: (input: TemplateInput) => Promise<{ delivered: boolean; error?: string }>;
};

/** Provider oficial — WhatsApp Cloud API (Meta). */
const metaProvider: ChannelProvider = {
  id: "meta",
  async send(input) {
    const token = process.env["WHATSAPP_TOKEN"]!;
    const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"]!;
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: onlyDigits(input.phone),
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: "pt_BR" },
            components: [
              { type: "body", parameters: [{ type: "text", text: input.investorName }] },
            ],
          },
        }),
      });
      if (!res.ok) return { delivered: false, error: `Meta respondeu ${res.status}` };
      return { delivered: true };
    } catch (e) {
      return { delivered: false, error: e instanceof Error ? e.message : "Falha no envio" };
    }
  },
};

/**
 * Provider interno — substituto temporário e oficial da homologação.
 * Nenhuma mensagem sai para fora: o envio é considerado entregue e a
 * resposta chega pela simulação do Laboratório ou pelo Webhook.
 */
const internalProvider: ChannelProvider = {
  id: "interno",
  async send() {
    return { delivered: true };
  },
};

export function activeProvider(): ChannelProvider {
  const ready = Boolean(process.env["WHATSAPP_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"]);
  return ready ? metaProvider : internalProvider;
}

/** Dispara o Template Oficial pelo provider ativo e registra o envio. */
export async function sendOfficialTemplate(input: TemplateInput): Promise<TemplateDispatch> {
  const phone = onlyDigits(input.phone);
  const provider = activeProvider();
  const result = await provider.send({ ...input, phone });

  await supabaseAdmin.from("whatsapp_validations").insert({
    phone,
    journey_id: input.journeyId,
    investor_name: input.investorName,
    status: "enviado",
    template_name: TEMPLATE_NAME,
  });

  return { ok: true, provider: provider.id, delivered: result.delivered, error: result.error };
}

/** Última validação registrada para o número — usada no aguardo do Portal. */
export async function readLatestValidation(phone: string): Promise<ValidationRow | null> {
  const { data } = await supabaseAdmin
    .from("whatsapp_validations")
    .select("phone, journey_id, status, responded_at")
    .eq("phone", onlyDigits(phone))
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return {
    phone: row.phone,
    journeyId: row.journey_id,
    status: (row.status as ValidationStatus) ?? "enviado",
    respondedAt: row.responded_at,
  };
}

/** Resposta recebida no Webhook oficial da Meta. */
export async function recordReply(input: {
  phone: string;
  status: Exclude<ValidationStatus, "enviado">;
  raw: unknown;
}): Promise<void> {
  const phone = onlyDigits(input.phone);
  const { data } = await supabaseAdmin
    .from("whatsapp_validations")
    .select("id")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1);
  const id = data?.[0]?.id;
  const patch = {
    status: input.status,
    responded_at: new Date().toISOString(),
    raw: input.raw as never,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    await supabaseAdmin.from("whatsapp_validations").update(patch).eq("id", id);
    return;
  }
  await supabaseAdmin.from("whatsapp_validations").insert({ phone, ...patch });
}

/** Interpreta o corpo do Webhook e extrai telefone + resposta do botão. */
export function parseWebhookReply(
  payload: unknown,
): { phone: string; status: Exclude<ValidationStatus, "enviado"> } | null {
  try {
    const body = payload as {
      entry?: {
        changes?: {
          value?: {
            messages?: {
              from?: string;
              text?: { body?: string };
              button?: { text?: string; payload?: string };
              interactive?: { button_reply?: { title?: string; id?: string } };
            }[];
          };
        }[];
      }[];
    };
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message?.from) return null;
    const answer = (
      message.button?.payload ??
      message.button?.text ??
      message.interactive?.button_reply?.id ??
      message.interactive?.button_reply?.title ??
      message.text?.body ??
      ""
    )
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
    if (!answer) return null;
    if (answer.startsWith("NAO") || answer.startsWith("NÃO")) {
      return { phone: onlyDigits(message.from), status: "recusado" };
    }
    if (answer.startsWith("CONFIRMAR") || answer === "SIM") {
      return { phone: onlyDigits(message.from), status: "confirmado" };
    }
    return null;
  } catch {
    return null;
  }
}