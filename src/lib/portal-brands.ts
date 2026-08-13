/**
 * Marcas / operações do ecossistema Velox.
 *
 * O link público do Portal do Investidor identifica sempre DUAS
 * informações independentes: a MARCA (prefixo da rota) e o EXECUTIVO
 * (slug permanente do cadastro). Nunca o nome do lead.
 *
 *   /f/{executivo}    → Velox Financeira
 *   /s/{executivo}    → Velox Solar
 *   /seg/{executivo}  → Velox Seguros
 *
 * `/e/{executivo}` permanece como estrutura LEGADA/INTERNA e continua
 * funcionando, resolvendo para a marca padrão (Financeira).
 */

export type PortalBrandKey = "financeira" | "solar" | "seguros";

export type PortalBrand = {
  key: PortalBrandKey;
  /** Prefixo público da rota (sem barras). */
  prefix: string;
  name: string;
  shortName: string;
  origin: string;
};

export const PORTAL_BRANDS: readonly PortalBrand[] = [
  {
    key: "financeira",
    prefix: "f",
    name: "Velox Financeira",
    shortName: "Financeira",
    origin: "Link personalizado · Velox Financeira",
  },
  {
    key: "solar",
    prefix: "s",
    name: "Velox Solar",
    shortName: "Solar",
    origin: "Link personalizado · Velox Solar",
  },
  {
    key: "seguros",
    prefix: "seg",
    name: "Velox Seguros",
    shortName: "Seguros",
    origin: "Link personalizado · Velox Seguros",
  },
] as const;

/** Marca padrão de toda operação atual e dos links legados `/e/`. */
export const DEFAULT_BRAND_KEY: PortalBrandKey = "financeira";

export function getBrand(key?: string | null): PortalBrand {
  return (
    PORTAL_BRANDS.find((b) => b.key === (key ?? "").trim().toLowerCase()) ??
    PORTAL_BRANDS.find((b) => b.key === DEFAULT_BRAND_KEY)!
  );
}

export function getBrandByPrefix(prefix: string): PortalBrand | null {
  const key = prefix.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  return PORTAL_BRANDS.find((b) => b.prefix === key) ?? null;
}

/**
 * Caminho público permanente do Portal do Investidor.
 * Nunca depende do lead, da etapa do CRM ou de sincronizações.
 */
export function investorPortalPath(
  executiveSlug: string,
  brandKey: string = DEFAULT_BRAND_KEY,
): string {
  return `/${getBrand(brandKey).prefix}/${executiveSlug}`;
}

/**
 * URL absoluta usada na variável `{{link_portal_investidor}}` das
 * mensagens automáticas.
 */
export function investorPortalUrl(
  executiveSlug: string,
  brandKey: string = DEFAULT_BRAND_KEY,
  baseUrl?: string,
): string {
  const base =
    baseUrl ??
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://velox-pathfinder-hub.lovable.app");
  return `${base.replace(/\/+$/, "")}${investorPortalPath(executiveSlug, brandKey)}`;
}

/** Nome da variável disponível para a futura automação de mensagens. */
export const INVESTOR_PORTAL_LINK_VARIABLE = "{{link_portal_investidor}}";
