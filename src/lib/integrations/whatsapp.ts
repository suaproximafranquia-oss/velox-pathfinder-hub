/**
 * WhatsApp — camada oficial de envio.
 *
 * DEF 3.0.2 §3/§4: a validação de identidade NUNCA abre WhatsApp Web nem
 * o aplicativo. O envio pertence exclusivamente ao CRM, através da Cloud
 * API oficial (ver `@/lib/crm/whatsapp-official`). O link `wa.me` continua
 * disponível apenas para o contato comercial explícito do investidor.
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

/**
 * Provedor padrão: apenas devolve o endereço oficial. Nenhuma janela é
 * aberta automaticamente — quem decide abrir é o ponto de chamada
 * comercial, jamais o fluxo de validação.
 */
const clickToChat: WhatsAppProvider = {
  id: "click-to-chat",
  label: "WhatsApp (clique para conversar)",
  enabled: true,
  async send(message) {
    return { channel: "click-to-chat", ok: true, url: buildClickToChatUrl(message) };
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