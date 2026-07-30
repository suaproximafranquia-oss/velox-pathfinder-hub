/**
 * WhatsApp — preparação da arquitetura para a Business API (próximo épico).
 *
 * Hoje o Portal usa links `wa.me` (clique-para-conversar). Esta camada
 * padroniza o envio de mensagens para que a troca pela Cloud API oficial
 * aconteça sem alterar nenhum ponto de chamada: basta um provedor com
 * `enabled: true` ser registrado.
 */
export type WhatsAppMessage = {
  /** Número em formato internacional, apenas dígitos (ex.: 5517997727337). */
  to: string;
  text: string;
  /** Referência interna (lead, reunião) para auditoria futura. */
  reference?: string;
};

export type WhatsAppDeliveryResult = {
  channel: "click-to-chat" | "business-api";
  ok: boolean;
  url?: string;
  messageId?: string;
  error?: string;
};

export type WhatsAppProvider = {
  id: string;
  label: string;
  enabled: boolean;
  send: (message: WhatsAppMessage) => Promise<WhatsAppDeliveryResult>;
};

export function buildClickToChatUrl(message: WhatsAppMessage): string {
  const digits = message.to.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message.text)}`;
}

const clickToChat: WhatsAppProvider = {
  id: "click-to-chat",
  label: "WhatsApp (clique para conversar)",
  enabled: true,
  async send(message) {
    const url = buildClickToChatUrl(message);
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
    return { channel: "click-to-chat", ok: true, url };
  },
};

let provider: WhatsAppProvider = clickToChat;

/** Substituído pela Business API quando as credenciais forem provisionadas. */
export function registerWhatsAppProvider(next: WhatsAppProvider) {
  provider = next.enabled ? next : clickToChat;
}

export function activeWhatsAppProvider(): WhatsAppProvider {
  return provider;
}

export function sendWhatsApp(message: WhatsAppMessage): Promise<WhatsAppDeliveryResult> {
  return provider.send(message);
}