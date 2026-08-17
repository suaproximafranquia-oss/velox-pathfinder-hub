/**
 * DEF 3.0.2 §3 e §5 — canal oficial do CRM com a WhatsApp Cloud API.
 *
 * O Portal NUNCA conversa com o WhatsApp: quem envia o Template Oficial
 * é exclusivamente o CRM, através deste módulo de servidor. As respostas
 * do investidor chegam pelo Webhook da Meta e ficam registradas na base
 * oficial de validações.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isProductionRequest } from "@/server/environment.server";
import {
  CHANNEL_UNAVAILABLE_MESSAGE,
  resolveChannelMode,
  type ChannelMode,
} from "@/lib/relationship/channel";

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
 * Provider interno — EXCLUSIVO de homologação. Nenhuma mensagem sai
 * para fora e o envio é considerado entregue apenas para permitir os
 * testes do fluxo. Em produção este provider nunca é usado.
 */
const internalProvider: ChannelProvider = {
  id: "interno",
  async send() {
    return { delivered: true };
  },
};

/**
 * Em produção só existe o canal oficial da Meta: sem credenciais, o
 * envio falha de forma explícita — jamais é simulado como entregue.
 */
const unavailableProvider: ChannelProvider = {
  id: "meta",
  async send() {
    return {
      delivered: false,
      error: CHANNEL_UNAVAILABLE_MESSAGE,
    };
  },
};

/**
 * COMANDO 3B §4 — o AMBIENTE decide primeiro. Homologação nunca alcança
 * a Meta, mesmo que as credenciais reais estejam configuradas.
 */
export function channelMode(): ChannelMode {
  return resolveChannelMode({
    production: isProductionRequest(),
    hasCredentials: Boolean(
      process.env["WHATSAPP_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"],
    ),
  });
}

export function activeProvider(): ChannelProvider {
  const mode = channelMode();
  if (mode === "simulator") return internalProvider;
  return mode === "meta" ? metaProvider : unavailableProvider;
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
export async function sendTextMessage(input: {
  phone: string;
  body: string;
}): Promise<{ ok: true; provider: ChannelProviderId; delivered: boolean; error?: string }> {
  const phone = onlyDigits(input.phone);
  const mode = channelMode();
  // Homologação: simulação sempre — nenhuma chamada HTTP para a Meta.
  if (mode === "simulator") return { ok: true, provider: "interno", delivered: true };
  if (mode === "unavailable") {
    // Produção nunca finge entrega: o executivo precisa saber que a
    // mensagem não saiu.
    return { ok: true, provider: "meta", delivered: false, error: CHANNEL_UNAVAILABLE_MESSAGE };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${process.env["WHATSAPP_PHONE_NUMBER_ID"]}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env["WHATSAPP_TOKEN"]}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: input.body },
        }),
      },
    );
    if (!res.ok)
      return { ok: true, provider: "meta", delivered: false, error: `Meta respondeu ${res.status}` };
    return { ok: true, provider: "meta", delivered: true };
  } catch (e) {
    return {
      ok: true,
      provider: "meta",
      delivered: false,
      error: e instanceof Error ? e.message : "Falha no envio",
    };
  }
}

export async function readLatestValidation(phone: string): Promise<ValidationRow | null> {
  return readLatestValidationRow(phone);
}

export type WhatsappMediaKind = "documento" | "imagem" | "video" | "audio";

const MEDIA_TYPE: Record<WhatsappMediaKind, "document" | "image" | "video" | "audio"> = {
  documento: "document",
  imagem: "image",
  video: "video",
  audio: "audio",
};

/**
 * Envio de anexo pelo canal oficial da Meta: o arquivo é carregado em
 * /media e a mensagem referencia o identificador retornado. Nenhuma
 * entrega é simulada — falhas voltam com o motivo real.
 */
export async function sendMediaMessage(input: {
  phone: string;
  kind: WhatsappMediaKind;
  mimeType: string;
  filename: string;
  /** Conteúdo do arquivo em base64 (sem o prefixo data:). */
  base64: string;
  caption?: string;
}): Promise<{ ok: true; delivered: boolean; error?: string }> {
  const phone = onlyDigits(input.phone);
  const mode = channelMode();
  if (mode === "simulator") {
    // Homologação: o anexo é registrado como simulado e nunca sobe para a Meta.
    return { ok: true, delivered: true };
  }
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (mode === "unavailable" || !token || !phoneId) {
    return { ok: true, delivered: false, error: CHANNEL_UNAVAILABLE_MESSAGE };
  }
  try {
    const bytes = Uint8Array.from(atob(input.base64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", input.mimeType);
    form.append(
      "file",
      new Blob([bytes as unknown as BlobPart], { type: input.mimeType }),
      input.filename,
    );
    const upload = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const uploadBody = await upload.text();
    if (!upload.ok) {
      return { ok: true, delivered: false, error: `Meta respondeu ${upload.status}: ${uploadBody}` };
    }
    const mediaId = (JSON.parse(uploadBody) as { id?: string }).id;
    if (!mediaId) return { ok: true, delivered: false, error: "A Meta não devolveu o anexo." };

    const type = MEDIA_TYPE[input.kind];
    const media: Record<string, unknown> = { id: mediaId };
    if (type === "document") media["filename"] = input.filename;
    if (input.caption && (type === "image" || type === "video" || type === "document")) {
      media["caption"] = input.caption;
    }
    const send = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type, [type]: media }),
    });
    if (!send.ok) {
      return { ok: true, delivered: false, error: `Meta respondeu ${send.status}: ${await send.text()}` };
    }
    return { ok: true, delivered: true };
  } catch (e) {
    return { ok: true, delivered: false, error: e instanceof Error ? e.message : "Falha no envio" };
  }
}

async function readLatestValidationRow(phone: string): Promise<ValidationRow | null> {
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
/**
 * COMANDO 3B §3 — a porta pública do Template Oficial deixa de aceitar
 * qualquer número arbitrário. O disparo só é autorizado quando o par
 * (jornada, telefone) corresponde a um lead real do Portal.
 *
 * Isto NÃO altera os dados do Portal dos Leads: é apenas leitura.
 */
export async function assertValidationRecipient(input: {
  journeyId: string;
  phone: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const phone = onlyDigits(input.phone);
  if (phone.length < 10) return { ok: false, reason: "Telefone inválido." };
  if (input.journeyId.toUpperCase().startsWith("TEST-")) {
    return { ok: false, reason: "Registro de teste não pode usar o canal oficial." };
  }
  const { data } = await supabaseAdmin
    .from("portal_leads")
    .select("id, whatsapp")
    .eq("id", input.journeyId)
    .maybeSingle();
  if (!data) return { ok: false, reason: "Jornada não encontrada — envio bloqueado." };
  if (onlyDigits(data.whatsapp ?? "") !== phone) {
    return { ok: false, reason: "Telefone não corresponde à jornada — envio bloqueado." };
  }
  return { ok: true };
}
