/**
 * IDENTIDADE CANÔNICA — REGRAS PURAS (BLOCO 2).
 *
 * A identidade canônica é um VÍNCULO: ela agrupa a pessoa, mas não
 * substitui, funde nem apaga cards. Este arquivo contém apenas a
 * decisão (chave, prioridade e conflito); a leitura/gravação vive em
 * `@/server/crm/identity.server`.
 *
 * PRIORIDADE DA CHAVE:
 *   1. telefone normalizado (identificador forte);
 *   2. e-mail;
 *   3. nome — SOMENTE como confirmação/desempate, nunca sozinho.
 *
 * A ORIGEM (GreenSales, Portal, TikTok, Meta) NÃO faz parte da chave:
 * a mesma pessoa pode chegar por qualquer canal e deve poder ser
 * reconhecida quando houver evidência suficiente.
 */
import { normalizePhone } from "@/lib/greensales/normalize";
import { foldName } from "@/lib/relationship/name-base";

/** Forma canônica comparável do telefone (sem DDI, só dígitos). */
export function phoneIdentityDigits(value: string | null | undefined): string {
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
}

export function phoneIdentityKey(value: string | null | undefined): string | null {
  const digits = phoneIdentityDigits(value);
  return digits ? `p:${digits}` : null;
}

export function emailIdentityKey(value: string | null | undefined): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return `e:${email}`;
}

export type IdentityInput = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type IdentityKeyDecision = {
  /** Chave forte escolhida, quando existir. */
  key: string | null;
  basis: "telefone" | "email" | "nenhum";
  phoneKey: string | null;
  emailKey: string | null;
  reason: string;
};

/**
 * Escolhe a chave forte. SEM telefone e SEM e-mail a identidade continua
 * existindo, apoiada no card/origem — nunca se bloqueia a entrada de um
 * lead por falta de identificador.
 */
export function decideIdentityKey(input: IdentityInput): IdentityKeyDecision {
  const phoneKey = phoneIdentityKey(input.phone);
  const emailKey = emailIdentityKey(input.email);
  if (phoneKey) {
    return {
      key: phoneKey,
      basis: "telefone",
      phoneKey,
      emailKey,
      reason: "Identidade apoiada no telefone normalizado.",
    };
  }
  if (emailKey) {
    return {
      key: emailKey,
      basis: "email",
      phoneKey,
      emailKey,
      reason: "Sem telefone válido — identidade apoiada no e-mail.",
    };
  }
  return {
    key: null,
    basis: "nenhum",
    phoneKey,
    emailKey,
    reason:
      "Sem identificador forte — identidade apoiada apenas no card/origem, sem fusão automática.",
  };
}

/** Primeiro nome dobrado (sem acento, minúsculo). */
function firstToken(value: string | null | undefined): string {
  const folded = foldName(String(value ?? ""));
  return folded.split(/\s+/).filter(Boolean)[0] ?? "";
}

/**
 * Nomes compatíveis o suficiente para manter o vínculo automático?
 *
 * Telefone é forte, mas NÃO é prova absoluta (número reaproveitado,
 * telefone de familiar). Nomes claramente incompatíveis viram CONFLITO
 * — nunca fusão automática e nunca bloqueio do lead.
 */
export function namesCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = foldName(String(a ?? ""));
  const right = foldName(String(b ?? ""));
  if (!left || !right) return true;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  return firstToken(left) === firstToken(right);
}
