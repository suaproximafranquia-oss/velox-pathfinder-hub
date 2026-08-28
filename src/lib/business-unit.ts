/**
 * UNIDADES DE NEGÓCIO DA VELOX.
 *
 * Toda a área OPERACIONAL vive abaixo do prefixo da unidade de negócio:
 *
 *   /f    → Velox Financeira   (única unidade operacional hoje)
 *   /s    → Velox Solar        (preparado)
 *   /seg  → Velox Seguros      (preparado)
 *
 * O prefixo é o MESMO usado pelos links personalizados públicos
 * (`/f/{executivo}`), que continuam intocados: o roteador dá precedência
 * aos segmentos estáticos (`/f/executivo`, `/f/crm`, …), por isso esses
 * nomes são SLUGS RESERVADOS e não podem ser atribuídos a um executivo.
 *
 * Nenhuma tela deve escrever `/f/...` manualmente: use `unitPath()`.
 */

export type BusinessUnitKey = "financeira" | "solar" | "seguros";

export type BusinessUnit = {
  key: BusinessUnitKey;
  /** Prefixo da rota, sem barras. */
  prefix: string;
  name: string;
  /** Unidade com ambiente operacional ativo. */
  operational: boolean;
};

export const BUSINESS_UNITS: readonly BusinessUnit[] = [
  { key: "financeira", prefix: "f", name: "Velox Financeira", operational: true },
  { key: "solar", prefix: "s", name: "Velox Solar", operational: false },
  { key: "seguros", prefix: "seg", name: "Velox Seguros", operational: false },
] as const;

/** Unidade operacional corrente do Workspace. */
export const DEFAULT_UNIT: BusinessUnitKey = "financeira";

export function getUnit(key: BusinessUnitKey = DEFAULT_UNIT): BusinessUnit {
  return BUSINESS_UNITS.find((u) => u.key === key) ?? BUSINESS_UNITS[0];
}

/**
 * Caminho operacional dentro da unidade FINANCEIRA (única operacional).
 *   unitPath("/executivo/home") → "/f/executivo/home"
 *
 * O tipo devolvido preserva o literal (`/f/executivo/home`), para que o
 * roteador continue validando cada destino em tempo de compilação: a
 * centralização não pode custar a segurança de rota.
 */
export function unitPath<P extends `/${string}`>(path: P): `/f${P}` {
  const prefix = `/${getUnit("financeira").prefix}`;
  const clean = path.startsWith(`${prefix}/`) || path === prefix ? path : `${prefix}${path}`;
  return clean as `/f${P}`;
}

/** Versão dinâmica, para unidades ainda não operacionais. */
export function unitPathFor(unit: BusinessUnitKey, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const prefix = `/${getUnit(unit).prefix}`;
  return clean.startsWith(`${prefix}/`) || clean === prefix ? clean : `${prefix}${clean}`;
}

/** Unidade de negócio a que um pathname pertence (null = área pública). */
export function currentUnit(pathname: string): BusinessUnit | null {
  const segment = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!segment) return null;
  return BUSINESS_UNITS.find((u) => u.prefix === segment) ?? null;
}

/** O pathname está dentro de um ambiente operacional interno? */
export function isOperationalPath(pathname: string): boolean {
  const unit = currentUnit(pathname);
  if (!unit) return false;
  const second = pathname.split("/").filter(Boolean)[1]?.toLowerCase();
  return !!second && RESERVED_UNIT_SLUGS.includes(second);
}

/**
 * Slugs que pertencem à arquitetura da unidade e por isso NUNCA podem ser
 * atribuídos a um executivo/link personalizado.
 */
export const RESERVED_UNIT_SLUGS: readonly string[] = [
  "executivo",
  "crm",
  "remarketing",
  "portal-leads",
] as const;

/** Normalização oficial do slug — sempre aplicada ANTES de qualquer comparação. */
export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_UNIT_SLUGS.includes(normalizeSlug(slug));
}

export type SlugValidation =
  | { ok: true; slug: string }
  | { ok: false; slug: string; message: string; suggestion: string };

/**
 * VALIDAÇÃO OFICIAL DO SLUG — rejeita, nunca transforma em silêncio.
 *
 * Normaliza, compara sem diferenciar maiúsculas/minúsculas e recusa os
 * nomes que pertencem à arquitetura da unidade (`/f/executivo`, `/f/crm`,
 * …). Deve ser usada na criação, na edição e no ponto de persistência.
 */
export function validateExecutiveSlug(raw: string): SlugValidation {
  const slug = normalizeSlug(raw);
  if (!slug) {
    return {
      ok: false,
      slug,
      message: "Informe um endereço válido para o link personalizado.",
      suggestion: "",
    };
  }
  if (isReservedSlug(slug)) {
    return {
      ok: false,
      slug,
      message: `O endereço "${slug}" é reservado pela plataforma (/f/${slug}) e não pode ser usado em um link personalizado.`,
      suggestion: suggestExecutiveSlug(slug),
    };
  }
  return { ok: true, slug };
}

/**
 * SUGESTÃO de alternativa quando o slug informado é reservado.
 *
 * ATENÇÃO: este helper NÃO deve ser usado para corrigir um valor antes de
 * gravar. A gravação passa obrigatoriamente por `validateExecutiveSlug`,
 * que rejeita. Aqui só produzimos um valor para oferecer ao usuário.
 */
export function suggestExecutiveSlug(slug: string): string {
  const key = normalizeSlug(slug);
  return isReservedSlug(key) ? `${key}-velox` : key;
}

/** @deprecated Use `validateExecutiveSlug` (rejeita) ou `suggestExecutiveSlug`. */
export const safeExecutiveSlug = suggestExecutiveSlug;
