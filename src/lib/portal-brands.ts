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

/**
 * Única origem pública oficial dos links EXTERNOS entregues ao investidor.
 * Não representa nem altera a origem em que a aplicação está executando.
 */
export const FINANCEIRA_PUBLIC_ORIGIN = "https://portalvelox.com.br";

/**
 * Resolve somente a origem pública externa da Financeira.
 * A origem da aplicação (Lovable, preview, localhost ou homologação) não
 * participa desta decisão e continua sendo governada pela navegação interna.
 */
export function financeiraPublicOrigin(): string {
  return FINANCEIRA_PUBLIC_ORIGIN;
}

/** Constrói uma URL pública da Financeira sem alterar o caminho recebido. */
export function financeiraPublicUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${financeiraPublicOrigin()}${cleanPath}`;
}

/**
 * Migra somente uma URL pública de navegação já persistida no host antigo.
 * URLs de assets e qualquer outro host permanecem intocadas pelos chamadores.
 */
export function normalizeFinanceiraPublicUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== "https://velox-pathfinder-hub.lovable.app") return url;
    return `${FINANCEIRA_PUBLIC_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

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
 * Destino público padrão de todo link normal entregue ao investidor da
 * Financeira. A rota personalizada continua única; `m=manual` apenas abre
 * diretamente o Manual pelo mecanismo oficial do Portal.
 */
export function investorManualUrl(executiveSlug: string): string {
  const path = investorPortalPath(executiveSlug, DEFAULT_BRAND_KEY);
  return financeiraPublicUrl(`${path}?m=manual`);
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
  if (getBrand(brandKey).key === DEFAULT_BRAND_KEY) {
    return investorManualUrl(executiveSlug);
  }

  // As demais marcas não fazem parte desta troca de domínio e conservam
  // integralmente a resolução anterior.
  const base =
    baseUrl ??
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://velox-pathfinder-hub.lovable.app");
  return `${base.replace(/\/+$/, "")}${investorPortalPath(executiveSlug, brandKey)}`;
}

/** Nome da variável disponível para a futura automação de mensagens. */
export const INVESTOR_PORTAL_LINK_VARIABLE = "{{link_portal_investidor}}";
