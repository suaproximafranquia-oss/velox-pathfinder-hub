/**
 * NÚMERO DE WHATSAPP — NORMALIZAÇÃO E VALIDAÇÃO ÚNICAS (COMANDO 2A §6).
 *
 * Existe UMA função para transformar um número cadastrado em link
 * `wa.me`. Nenhuma tela monta o link por conta própria e NENHUM número
 * fixo de empresa ou de administrador é usado como alternativa: sem
 * número válido no perfil do executivo responsável, o resultado é um
 * estado controlado e identificável, nunca um link inventado.
 */
export type WhatsappNumber =
  | { valid: true; digits: string; waLink: string; display: string }
  | { valid: false; reason: string };

export const WHATSAPP_MISSING_REASON =
  "WhatsApp do executivo responsável ainda não está configurado.";

const INVALID_REASON = "Número de WhatsApp inválido para geração de link.";

/**
 * Aceita o que o cadastro tiver (com máscara, espaços, +55, parênteses)
 * e devolve apenas dígitos em formato internacional do Brasil.
 * Não "conserta" números impossíveis: recusa.
 */
export function normalizeWhatsappNumber(raw: string | null | undefined): WhatsappNumber {
  const digits = String(raw ?? "").replace(/\D+/g, "");
  if (digits.length === 0) return { valid: false, reason: WHATSAPP_MISSING_REASON };

  // 10 (fixo) ou 11 (celular) dígitos = número nacional sem DDI.
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;

  // Com DDI do Brasil o total é 12 (fixo) ou 13 (celular).
  const brazilian = full.startsWith("55") && (full.length === 12 || full.length === 13);
  // Outros países: aceitamos apenas um intervalo plausível de E.164.
  const international = !full.startsWith("55") && full.length >= 11 && full.length <= 15;
  if (!brazilian && !international) return { valid: false, reason: INVALID_REASON };

  return {
    valid: true,
    digits: full,
    waLink: `https://wa.me/${full}`,
    display: full,
  };
}

/** Link com texto pré-preenchido — mesma validação, sem exceções. */
export function whatsappLinkWithText(
  raw: string | null | undefined,
  text: string,
): string | null {
  const number = normalizeWhatsappNumber(raw);
  if (!number.valid) return null;
  const message = text.trim();
  return message.length > 0
    ? `${number.waLink}?text=${encodeURIComponent(message)}`
    : number.waLink;
}
