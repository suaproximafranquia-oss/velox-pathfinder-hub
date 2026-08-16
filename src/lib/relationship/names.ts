/**
 * NOME DO INVESTIDOR (COMANDO 2A §46–§52, §102–§104).
 *
 * O valor bruto do cadastro nunca é tratado como nome confiável. Sem
 * confirmação, o motor usa o tratamento neutro do próprio template.
 */
export type NameStatus = "confirmado" | "nao_confirmado";

const INVALID_TOKENS = [
  "lead",
  "teste",
  "test",
  "cliente",
  "contato",
  "whatsapp",
  "facebook",
  "instagram",
  "sem nome",
  "nao informado",
  "não informado",
];

/** Higieniza sem inventar: remove ruídos e normaliza capitalização. */
export function normalizeName(raw: string | null | undefined): string {
  const value = (raw ?? "")
    .replace(/[0-9_]+/g, " ")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((part) => (part.length <= 2 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

/** Primeiro nome utilizável, quando houver. */
export function firstName(raw: string | null | undefined): string {
  const normalized = normalizeName(raw);
  return normalized.split(" ")[0] ?? "";
}

/**
 * O cadastro sozinho nunca confirma o nome: ele apenas indica se existe
 * um candidato plausível para confirmação manual pelo Executivo.
 */
export function isPlausibleName(raw: string | null | undefined): boolean {
  const normalized = normalizeName(raw).toLowerCase();
  if (normalized.length < 3) return false;
  return !INVALID_TOKENS.some((token) => normalized.includes(token));
}

export type NameResolution =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/** Resolve `{{nome_investidor}}` somente quando confirmado. */
export function resolveInvestorName(input: {
  confirmed: boolean;
  confirmedName?: string | null;
}): NameResolution {
  if (!input.confirmed) {
    return { ok: false, reason: "Nome ainda não confirmado — usar tratamento neutro do template." };
  }
  const value = firstName(input.confirmedName);
  if (!value) return { ok: false, reason: "Nome confirmado está vazio após normalização." };
  return { ok: true, value };
}