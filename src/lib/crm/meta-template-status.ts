/**
 * VOCABULÁRIO CONTROLADO DO STATUS META — REGRA ÚNICA.
 *
 * `status` guarda a APROVAÇÃO DA META (fato externo, lido do
 * Gerenciador). `is_active` guarda a VIGÊNCIA NO PORTAL (decisão
 * interna). São coisas diferentes e nunca se substituem.
 *
 * Esta é a única fonte da pergunta "este template está aprovado pela
 * Meta?" — Central de Templates, E0 e Remarketing usam esta mesma
 * função; não existe segunda regra.
 */
export type MetaApprovalStatus = "aprovado" | "pendente" | "rejeitado" | "pausado";

export const META_STATUS_LABEL: Record<MetaApprovalStatus, string> = {
  aprovado: "Aprovado pela Meta",
  pendente: "Pendente na Meta",
  rejeitado: "Rejeitado pela Meta",
  pausado: "Pausado pela Meta",
};

/** Variações realmente observadas nas capturas (PT/EN, maiúsculas, acentos). */
const SYNONYMS: Record<string, MetaApprovalStatus> = {
  aprovado: "aprovado",
  aprovada: "aprovado",
  approved: "aprovado",
  ativo: "aprovado",
  active: "aprovado",
  pendente: "pendente",
  "em analise": "pendente",
  "em revisao": "pendente",
  pending: "pendente",
  "in review": "pendente",
  "in_review": "pendente",
  submitted: "pendente",
  rejeitado: "rejeitado",
  rejeitada: "rejeitado",
  reprovado: "rejeitado",
  rejected: "rejeitado",
  pausado: "pausado",
  pausada: "pausado",
  paused: "pausado",
  disabled: "pausado",
  desativado: "pausado",
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Converte o texto lido na Meta para o vocabulário controlado.
 * Valor ausente ou não reconhecido devolve `null` — nunca é presumido
 * como aprovado.
 */
export function normalizeMetaStatus(value: string | null | undefined): MetaApprovalStatus | null {
  const text = fold(String(value ?? ""));
  if (!text) return null;
  return SYNONYMS[text] ?? null;
}

/** REGRA ÚNICA de aprovação usada por E0, Remarketing e Central. */
export function isMetaApproved(value: string | null | undefined): boolean {
  return normalizeMetaStatus(value) === "aprovado";
}

/** Rótulo legível, sem inventar informação que a Meta não forneceu. */
export function metaStatusLabel(value: string | null | undefined): string {
  const normalized = normalizeMetaStatus(value);
  if (normalized) return META_STATUS_LABEL[normalized];
  const raw = String(value ?? "").trim();
  return raw ? `${raw} (não reconhecido)` : "Não identificado";
}
