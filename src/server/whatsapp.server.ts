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

/** Dispara o Template Oficial da Meta e registra o envio. */
export async function sendOfficialTemplate(input: {
  phone: string;
  investorName: string;
  journeyId: string;
}): Promise<{ ok: boolean; delivered: boolean; error?: string }> {
  const phone = onlyDigits(input.phone);
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];

  let delivered = false;
  let error: string | undefined;

  if (token && phoneNumberId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: input.investorName }],
              },
            ],
          },
        }),
      });
      delivered = res.ok;
      if (!res.ok) error = `Meta respondeu ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : "Falha no envio";
    }
  } else {
    error = "Credenciais oficiais da Meta ainda não provisionadas";
  }

  await supabaseAdmin.from("whatsapp_validations").insert({
    phone,
    journey_id: input.journeyId,
    investor_name: input.investorName,
    status: "enviado",
    template_name: TEMPLATE_NAME,
  });

  return { ok: true, delivered, error };
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