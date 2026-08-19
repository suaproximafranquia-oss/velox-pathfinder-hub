/**
 * NOME DO INVESTIDOR (COMANDO 2A §46–§52, §102–§104).
 *
 * O valor bruto do cadastro nunca é tratado como nome confiável. Sem
 * confirmação, o motor usa o tratamento neutro do próprio template.
 */
export type NameStatus = "confirmado" | "nao_confirmado";

import { isKnownGivenName } from "./name-base";

/** Tratamento neutro obrigatório quando não há nome validado (§20). */
export const NEUTRAL_TREATMENT = "caro investidor";

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

/** Partículas que permanecem em minúsculas em nomes brasileiros. */
const NAME_PARTICLES = ["de", "da", "do", "das", "dos", "e", "di", "du", "del", "van", "von"];

/**
 * APRESENTAÇÃO DO NOME (padronização).
 *
 * "JOÃO", "joão" e "jOãO" viram "João" — sem alterar o dado original
 * armazenado. Acentos são preservados, partículas ficam em minúsculas e
 * sobrenomes compostos com hífen mantêm a estrutura.
 */
export function displayName(raw: string | null | undefined): string {
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value
    .split(" ")
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && NAME_PARTICLES.includes(lower)) return lower;
      return lower
        .split("-")
        .map((part) =>
          part ? part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1) : part,
        )
        .join("-");
    })
    .join(" ");
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

/**
 * Nome composto: "Maria Clara" só é tratado como tratamento completo
 * quando as duas partes são reconhecidas pela base de nomes.
 */
function compoundTreatment(parts: string[]): string {
  const first = parts[0] ?? "";
  const second = parts[1] ?? "";
  if (second && isKnownGivenName(first) && isKnownGivenName(second)) {
    return `${first} ${second}`;
  }
  return first;
}

/**
 * O valor recebido é reconhecido como possível NOME (§17–§19)?
 *
 * A base de nomes é apenas referência: entradas com múltiplas palavras
 * fora da base (ex.: "Quero informações") jamais viram tratamento.
 */
export function looksLikeName(raw: string | null | undefined): boolean {
  if (!isPlausibleName(raw)) return false;
  const parts = normalizeName(raw).split(" ").filter(Boolean);
  if (parts.length === 0) return false;
  // A primeira palavra precisa estar na base de nomes reconhecidos.
  return isKnownGivenName(parts[0]!);
}

/** Origem do tratamento aplicado — usada na auditoria da mensagem. */
export type TreatmentSource =
  | "confirmado_executivo"
  | "informado_executivo"
  | "base_de_nomes"
  | "fallback";

export type TreatmentResolution = {
  /** Texto que substitui {{nome_investidor}}. */
  treatment: string;
  source: TreatmentSource;
  /** true quando o tratamento é um nome real (não o neutro). */
  personalized: boolean;
};

/**
 * PRIORIZAÇÃO OFICIAL (§24):
 *   1. nome confirmado manualmente pelo Executivo;
 *   2. nome informado/corrigido manualmente pelo Executivo;
 *   3. nome reconhecido pela base de nomes;
 *   4. fallback "caro investidor".
 *
 * O valor bruto do cadastro nunca tem prioridade sobre estas regras e
 * uma negativa explícita do Executivo (`manuallyRejected`) impede
 * qualquer nova tentativa automática de interpretação.
 */
export function resolveTreatment(input: {
  rawName?: string | null;
  /** Nome confirmado pelo Executivo para ESTE lead (§21, §22). */
  confirmedName?: string | null;
  /** Nome digitado/corrigido pelo Executivo no cadastro do lead (§23). */
  executiveProvidedName?: string | null;
  /** O Executivo respondeu NÃO à sugestão de nome. */
  manuallyRejected?: boolean;
}): TreatmentResolution {
  const confirmed = compoundTreatment(
    normalizeName(input.confirmedName).split(" ").filter(Boolean),
  );
  if (confirmed) {
    return { treatment: confirmed, source: "confirmado_executivo", personalized: true };
  }
  const provided = compoundTreatment(
    normalizeName(input.executiveProvidedName).split(" ").filter(Boolean),
  );
  if (provided) {
    return { treatment: provided, source: "informado_executivo", personalized: true };
  }
  if (input.manuallyRejected) {
    return { treatment: NEUTRAL_TREATMENT, source: "fallback", personalized: false };
  }
  if (looksLikeName(input.rawName)) {
    const parts = normalizeName(input.rawName).split(" ").filter(Boolean);
    return { treatment: compoundTreatment(parts), source: "base_de_nomes", personalized: true };
  }
  return { treatment: NEUTRAL_TREATMENT, source: "fallback", personalized: false };
}

/**
 * Sugestão de confirmação manual (§21): "Possível nome detectado: X".
 * Retorna null quando não há candidato plausível.
 */
export function suggestNameForConfirmation(raw: string | null | undefined): string | null {
  if (!looksLikeName(raw)) return null;
  return compoundTreatment(normalizeName(raw).split(" ").filter(Boolean));
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