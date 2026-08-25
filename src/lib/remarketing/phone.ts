/**
 * Normalização de telefones do CRM de Remarketing.
 *
 * O operador cola números em qualquer formato. Aqui eles viram o padrão
 * interno do motor: somente dígitos, com DDI 55 do Brasil.
 * Nada deste módulo toca o CRM de Relacionamento.
 */
export type NormalizedPhone = {
  /** Texto exatamente como o operador colou. */
  raw: string;
  /** Número normalizado (E.164 sem "+"), quando válido. */
  phone: string | null;
  reason?: string;
};

export type PhoneParseResult = {
  valid: { raw: string; phone: string }[];
  invalid: NormalizedPhone[];
  duplicates: { raw: string; phone: string }[];
};

/** Converte uma entrada solta em número brasileiro normalizado. */
export function normalizePhone(input: string): NormalizedPhone {
  const raw = (input ?? "").trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return { raw, phone: null, reason: "Sem dígitos" };

  // Remove zeros de discagem nacional (0xx) antes do DDD.
  if (digits.length > 11 && digits.startsWith("0")) digits = digits.replace(/^0+/, "");

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (digits.length === 10 || digits.length === 11) {
    const ddd = Number(digits.slice(0, 2));
    if (ddd < 11 || ddd > 99) return { raw, phone: null, reason: "DDD inválido" };
    // Celular sem o nono dígito: completa quando o número começa por 9x/8x/7x/6x.
    if (digits.length === 10 && /^[6789]/.test(digits.slice(2))) {
      digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
    }
    if (digits.length === 11 && digits[2] !== "9") {
      return { raw, phone: null, reason: "Celular deve iniciar com 9" };
    }
    return { raw, phone: `55${digits}` };
  }

  return { raw, phone: null, reason: "Quantidade de dígitos inválida" };
}

/** Quebra o texto colado em linhas/separadores e normaliza tudo. */
export function parsePhoneList(text: string): PhoneParseResult {
  const tokens = (text ?? "")
    .split(/[\n\r,;|\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const valid: { raw: string; phone: string }[] = [];
  const invalid: NormalizedPhone[] = [];
  const duplicates: { raw: string; phone: string }[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const result = normalizePhone(token);
    if (!result.phone) {
      invalid.push(result);
      continue;
    }
    if (seen.has(result.phone)) {
      duplicates.push({ raw: result.raw, phone: result.phone });
      continue;
    }
    seen.add(result.phone);
    valid.push({ raw: result.raw, phone: result.phone });
  }

  return { valid, invalid, duplicates };
}

/** Exibição amigável: +55 (17) 99999-9999 */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  const national = d.startsWith("55") ? d.slice(2) : d;
  if (national.length === 11)
    return `+55 (${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10)
    return `+55 (${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return `+${d}`;
}
