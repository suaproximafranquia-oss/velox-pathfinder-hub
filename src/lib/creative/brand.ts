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

/**
 * Categorias previstas de peças. Apenas `unidade` está implementada;
 * as demais existem para que a expansão futura não exija refatoração
 * da arquitetura (Etapa 3 — preparação para expansão).
 */
export type CreativeCategory =
  | "unidade"
  | "feed"
  | "story"
  | "banner"
  | "folder"
  | "video";

export type CreativeCategoryDef = {
  id: CreativeCategory;
  label: string;
  /** Proporção da arte final. */
  width: number;
  height: number;
  status: "ativo" | "previsto";
  description: string;
};

export const CREATIVE_CATEGORIES: CreativeCategoryDef[] = [
  {
    id: "unidade",
    label: "Nova Unidade",
    width: 1080,
    height: 1350,
    status: "ativo",
    description: "Anúncio oficial de abertura de unidade — Institucional e Marketing.",
  },
  {
    id: "feed",
    label: "Feed",
    width: 1080,
    height: 1080,
    status: "previsto",
    description: "Publicação quadrada para feed das redes oficiais.",
  },
  {
    id: "story",
    label: "Story",
    width: 1080,
    height: 1920,
    status: "previsto",
    description: "Peça vertical para stories e formatos full screen.",
  },
  {
    id: "banner",
    label: "Banner",
    width: 1920,
    height: 640,
    status: "previsto",
    description: "Banner horizontal para site, e-mail e mídia paga.",
  },
  {
    id: "folder",
    label: "Folder",
    width: 1240,
    height: 1754,
    status: "previsto",
    description: "Material impresso institucional em proporção A4.",
  },
  {
    id: "video",
    label: "Vídeos",
    width: 1920,
    height: 1080,
    status: "previsto",
    description: "Roteiros e capas para peças audiovisuais oficiais.",
  },
];

export function activeCategories(): CreativeCategoryDef[] {
  return CREATIVE_CATEGORIES.filter((c) => c.status === "ativo");
}