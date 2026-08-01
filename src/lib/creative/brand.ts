/**
 * Identidade visual OFICIAL da Velox — fonte única de verdade da IA Criativa.
 *
 * A IA Criativa nunca inventa identidade: todo material gerado consome
 * exclusivamente os tokens, tipografias e proporções declarados aqui.
 * Alterações de marca acontecem apenas neste arquivo.
 */

export const BRAND = {
  name: "Velox",
  navy: "#0B1B33",
  navyDeep: "#060F1F",
  gold: "#C9A227",
  goldSoft: "#E4C767",
  white: "#FFFFFF",
  gray: "#8C97A8",
  grayDeep: "#4A5468",
  displayFont: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
  bodyFont: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  site: "velox.com.br",
} as const;

/** Modelos oficiais gerados automaticamente para cada nova unidade. */
export type CreativeModel = "institucional" | "marketing";

export const CREATIVE_MODEL_LABEL: Record<CreativeModel, string> = {
  institucional: "Modelo A — Institucional",
  marketing: "Modelo B — Marketing",
};

/** Única categoria oficial de peça — anúncio de nova unidade. */
export type CreativeCategory = "unidade";