/**
 * Messaging Service — única saída de mensagens do CRM.
 *
 * O CRM e as automações NUNCA falam diretamente com um provedor. Toda a
 * comunicação passa por aqui, o que permite trocar o provedor sem tocar
 * na interface ou nas regras de automação.
 */
import { sendTextMessage } from "@/server/whatsapp.server";

export type MessagingResult = {
  delivered: boolean;
  provider: string;
  /** false quando o provedor ainda não possui credenciais/configuração. */
  configured: boolean;
  /** Motivo legível quando a mensagem não pôde ser enviada. */
  error?: string;
};

export async function sendWhatsappText(input: {
  phone: string;
  body: string;
}): Promise<MessagingResult> {
  const digits = (input.phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) {
    return {
      delivered: false,
      provider: "nenhum",
      configured: true,
      error: "Lead sem telefone válido.",
    };
  }
  const res = await sendTextMessage({ phone: digits, body: input.body });
  const configured = res.delivered || !/n(ã|a)o configurado/i.test(res.error ?? "");
  return { delivered: res.delivered, provider: res.provider, configured, error: res.error };
}
