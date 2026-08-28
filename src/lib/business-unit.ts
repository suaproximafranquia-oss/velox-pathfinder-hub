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
 * Caminho operacional dentro da unidade.
 *   unitPath("/executivo/home") → "/f/executivo/home"
 */
export function unitPath(path: string, unit: BusinessUnitKey = DEFAULT_UNIT): string {
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

export function isReservedSlug(slug: string): boolean {
  return RESERVED_UNIT_SLUGS.includes(slug.trim().toLowerCase());
}

/** Garante um slug utilizável, afastando-o dos nomes reservados. */
export function safeExecutiveSlug(slug: string): string {
  const key = slug.trim().toLowerCase();
  return isReservedSlug(key) ? `${key}-velox` : key;
}
