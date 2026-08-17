/**
 * DECISÃO DE CANAL — REGRA DE AMBIENTE PRIMEIRO (COMANDO 3B §4).
 *
 * A existência de credenciais da Meta NUNCA é suficiente para autorizar
 * um envio real. O ambiente decide antes: homologação simula sempre,
 * mesmo com WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID configurados.
 */
export type ChannelMode = "meta" | "simulator" | "unavailable";

export function resolveChannelMode(input: {
  production: boolean;
  hasCredentials: boolean;
}): ChannelMode {
  // Homologação: simulador, sem exceção e sem fallback para provider real.
  if (!input.production) return "simulator";
  // Produção: canal oficial apenas quando as credenciais reais existem.
  return input.hasCredentials ? "meta" : "unavailable";
}

export const CHANNEL_UNAVAILABLE_MESSAGE =
  "Canal oficial do WhatsApp não configurado para este ambiente.";
