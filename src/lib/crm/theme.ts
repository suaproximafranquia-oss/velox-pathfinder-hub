/**
 * CRM de Relacionamento — identidade visual White Label.
 *
 * O módulo nasce com identidade NEUTRA (nenhuma cor institucional Velox).
 * Toda a interface consome exclusivamente as variáveis CSS abaixo, de modo
 * que logo, favicon, nome, cores, ícones e domínio possam ser trocados
 * futuramente por configuração — sem alterar código estrutural.
 */
export type CrmBranding = {
  /** Nome exibido da empresa proprietária do CRM. */
  companyName: string;
  /** Descrição curta exibida sob o nome. */
  tagline: string;
  /** URL do logo (opcional — sem logo exibimos apenas o nome). */
  logoUrl?: string;
  /** URL do favicon (aplicado em etapas futuras). */
  faviconUrl?: string;
  /** Domínio próprio do tenant (reservado para uso futuro). */
  domain?: string;
  /** Conjunto de ícones — apenas um identificador; sem lógica nesta etapa. */
  iconSet?: string;
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    background: string;
    surface: string;
    foreground: string;
    muted: string;
    border: string;
    /** Detalhe discreto para elementos ativos. */
    accent: string;
    /** Fundo suave do estado ativo/selecionado. */
    accentSoft: string;
    /** Fundo de passagem do ponteiro e campos discretos. */
    hover: string;
  };
};

/** Padrão neutro (escala de cinzas + azul-acinzentado discreto). */
export const DEFAULT_CRM_BRANDING: CrmBranding = {
  companyName: "CRM de Relacionamento",
  tagline: "Relacionamento com investidores",
  iconSet: "lucide",
  colors: {
    primary: "#3f4756",
    primaryForeground: "#ffffff",
    secondary: "#6b7280",
    secondaryForeground: "#ffffff",
    background: "#f7f7f8",
    surface: "#ffffff",
    foreground: "#1f2329",
    muted: "#6b7280",
    border: "#e3e5e8",
    accent: "#2f6feb",
    accentSoft: "#eaf0fd",
    hover: "#f1f2f4",
  },
};

/** Converte a marca em variáveis CSS aplicadas na raiz do módulo. */
export function crmCssVars(branding: CrmBranding): Record<string, string> {
  const c = branding.colors;
  return {
    "--crm-primary": c.primary,
    "--crm-primary-foreground": c.primaryForeground,
    "--crm-secondary": c.secondary,
    "--crm-secondary-foreground": c.secondaryForeground,
    "--crm-background": c.background,
    "--crm-surface": c.surface,
    "--crm-foreground": c.foreground,
    "--crm-muted": c.muted,
    "--crm-border": c.border,
    "--crm-accent": c.accent,
    "--crm-accent-soft": c.accentSoft,
    "--crm-hover": c.hover,
  };
}

/**
 * Ponto único de resolução da marca. Futuramente lerá a configuração do
 * tenant; hoje devolve sempre o padrão neutro.
 */
export function resolveCrmBranding(
  overrides?: Partial<CrmBranding>,
): CrmBranding {
  if (!overrides) return DEFAULT_CRM_BRANDING;
  return {
    ...DEFAULT_CRM_BRANDING,
    ...overrides,
    colors: { ...DEFAULT_CRM_BRANDING.colors, ...(overrides.colors ?? {}) },
  };
}