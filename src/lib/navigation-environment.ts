/**
 * AMBIENTE DE NAVEGAÇÃO — regra única e centralizada.
 *
 * "Home" nunca é genérica: Home é sempre a Home do AMBIENTE ATUAL.
 * Componentes compartilhados (chrome, logo, botões de voltar, página de
 * erro) devem descobrir o ambiente pelo pathname e usar `homePathFor`.
 *
 * Ambiente de navegação ≠ origem do lead. Portal do Investidor ≠ Portal
 * de Leads ≠ Portal como módulo interno do Workspace.
 */

import { currentUnit, RESERVED_UNIT_SLUGS } from "@/lib/business-unit";

export type NavigationEnvironment =
  | "workspace" // Portal do Executivo (/f/executivo/...)
  | "crm" // sem Home própria
  | "remarketing" // sem Home própria
  | "portal-leads" // sem Home própria
  | "investor-portal" // Portal do Investidor (/f e links personalizados)
  | "institucional"; // Grupo Velox (/)

/** Home oficial de cada ambiente. `null` = ambiente ainda sem Home própria. */
export type HomePath = "/f/executivo/home" | "/f" | "/";

export function environmentFor(pathname: string | undefined | null): NavigationEnvironment {
  const path = pathname ?? "/";
  const unit = currentUnit(path);
  if (!unit) return "institucional";

  const second = path.split("/").filter(Boolean)[1]?.toLowerCase();
  if (!second || !RESERVED_UNIT_SLUGS.includes(second)) {
    // `/f` ou `/f/{slug-do-executivo}` → Portal do Investidor.
    return "investor-portal";
  }

  if (second === "executivo") return "workspace";
  if (second === "crm") return "crm";
  if (second === "remarketing") return "remarketing";
  if (second === "portal-leads") return "portal-leads";
  return "workspace";
}

/**
 * Home do ambiente atual. Ambientes sem Home própria (CRM, Remarketing,
 * Portal de Leads) devolvem `null` — nenhuma Home nova é inventada aqui.
 */
export function homePathFor(pathname: string | undefined | null): HomePath | null {
  switch (environmentFor(pathname)) {
    case "workspace":
      return "/f/executivo/home";
    case "investor-portal":
      return "/f";
    case "institucional":
      return "/";
    default:
      return null;
  }
}

/** Home com fallback seguro para o institucional quando o ambiente não tem Home. */
export function homePathOrRoot(pathname: string | undefined | null): HomePath {
  return homePathFor(pathname) ?? "/";
}
