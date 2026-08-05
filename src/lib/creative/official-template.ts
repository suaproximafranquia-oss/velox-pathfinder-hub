/**
 * TEMPLATES GRÁFICOS — Modelo A (Institucional) e Modelo B (Marketing).
 *
 * Cada modelo possui o seu próprio arquivo de template e o seu próprio
 * conjunto de campos variáveis. O layout nunca é recriado: o motor abre
 * o PNG do modelo e substitui apenas os campos declarados abaixo. Todas
 * as coordenadas são frações (0 a 1) da largura/altura do template.
 */
import templateAsset from "@/assets/velox-template-oficial.png.asset.json";
import type { CreativeModel } from "./brand";

/** Template institucional embutido — usado enquanto nenhum upload existir. */
export const OFFICIAL_TEMPLATE_URL = (templateAsset as { url: string }).url;

export type TextBlock = {
  /** Fração horizontal; usada como centro (align "center") ou início. */
  x?: number;
  align: "center" | "left";
  /** Linha de base do texto (parte inferior das maiúsculas). */
  baselineY: number;
  /** Altura das maiúsculas, em fração da altura do template. */
  capHeight: number;
  maxWidth: number;
  tracking?: number;
  weight: number;
  color: string;
};

export type CopyBlock = TextBlock & {
  /** Altura de linha, em fração da altura do template. */
  lineHeight: number;
  /** Máximo de caracteres por linha e de linhas. */
  chars: number;
  lines: number;
};

export type TemplateLayout = {
  /** Faixa vertical da fotografia da cidade (topo → azul sólido). */
  photoArea: { y0: number; y1: number };
  /** Elemento gráfico preservado por cima da fotografia (selo). */
  badgeArea?: { x0: number; x1: number; y0: number; y1: number };
  city?: TextBlock;
  state?: TextBlock;
  /** Complemento "AGORA EM <CIDADE> - <UF>". */
  tail?: TextBlock;
  /** Textos publicitários produzidos pela IA (somente Modelo B). */
  headline?: CopyBlock;
  subheadline?: CopyBlock;
  supporting?: CopyBlock;
};

/**
 * Tipografia do template oficial: sans humanista de peso semibold —
 * mesma espessura e largura do material institucional da Velox.
 */
export const TEMPLATE_FONT =
  '"Poppins", "Montserrat", "Helvetica Neue", Helvetica, Arial, sans-serif';

const INSTITUTIONAL: TemplateLayout = {
  photoArea: { y0: 0, y1: 0.6 },
  badgeArea: { x0: 0.298, x1: 0.722, y0: 0.008, y1: 0.114 },
  city: {
    align: "center",
    baselineY: 0.5141,
    capHeight: 0.0455,
    maxWidth: 0.94,
    weight: 700,
    color: "#F26A12",
  },
  state: {
    align: "center",
    baselineY: 0.5729,
    capHeight: 0.0168,
    maxWidth: 0.86,
    tracking: 0.34,
    weight: 600,
    color: "#FFFFFF",
  },
  tail: {
    x: 0.252,
    align: "left",
    // Linha 3 do parágrafo institucional ("AGORA EM"), medida no arquivo.
    baselineY: 0.6675,
    capHeight: 0.0132,
    maxWidth: 0.72,
    tracking: 0.02,
    weight: 700,
    color: "#FFFFFF",
  },
};

/**
 * Modelo B — Marketing. Mesma mecânica do Modelo A: o template enviado
 * é preservado integralmente e apenas os campos abaixo são preenchidos.
 */
const MARKETING: TemplateLayout = {
  photoArea: { y0: 0, y1: 0.6 },
  city: {
    align: "center",
    baselineY: 0.5141,
    capHeight: 0.0455,
    maxWidth: 0.94,
    weight: 700,
    color: "#F26A12",
  },
  state: {
    align: "center",
    baselineY: 0.5729,
    capHeight: 0.0168,
    maxWidth: 0.86,
    tracking: 0.34,
    weight: 600,
    color: "#FFFFFF",
  },
  headline: {
    x: 0.06,
    align: "left",
    baselineY: 0.665,
    capHeight: 0.026,
    maxWidth: 0.88,
    lineHeight: 0.036,
    chars: 26,
    lines: 2,
    weight: 700,
    color: "#F26A12",
  },
  subheadline: {
    x: 0.06,
    align: "left",
    baselineY: 0.745,
    capHeight: 0.018,
    maxWidth: 0.88,
    lineHeight: 0.026,
    chars: 40,
    lines: 2,
    weight: 600,
    color: "#FFFFFF",
  },
  supporting: {
    x: 0.06,
    align: "left",
    baselineY: 0.81,
    capHeight: 0.014,
    maxWidth: 0.88,
    lineHeight: 0.021,
    chars: 52,
    lines: 2,
    weight: 500,
    color: "#FFFFFF",
  },
};

export const TEMPLATE_LAYOUT: Record<CreativeModel, TemplateLayout> = {
  institucional: INSTITUTIONAL,
  marketing: MARKETING,
};

/** Estados por extenso — a UF aparece escrita na arte oficial. */
export const STATE_NAMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export function stateName(uf: string): string {
  const key = (uf || "").trim().toUpperCase();
  return STATE_NAMES[key] ?? key;
}
