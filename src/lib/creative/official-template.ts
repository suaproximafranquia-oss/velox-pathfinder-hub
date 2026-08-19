/**
 * TEMPLATES GRÁFICOS — Modelo A (Institucional) e Modelo B (Marketing).
 *
 * Cada modelo possui o seu próprio arquivo de template e o seu próprio
 * conjunto de campos variáveis. O layout nunca é recriado: o motor abre
 * o PNG do modelo e substitui apenas os campos declarados abaixo. Todas
 * as coordenadas são frações (0 a 1) da largura/altura do template.
 */
import templateAsset from "@/assets/velox-template-oficial.png.asset.json";
import marketingAsset from "@/assets/velox-template-marketing.png.asset.json";
import type { CreativeModel } from "./brand";

/** Template institucional embutido — usado enquanto nenhum upload existir. */
export const OFFICIAL_TEMPLATE_URL = (templateAsset as { url: string }).url;

/** Template de marketing oficial embutido (Modelo B). */
export const MARKETING_TEMPLATE_URL = (marketingAsset as { url: string }).url;

/** Arquivo padrão de cada modelo, usado enquanto não houver upload. */
export const BUILTIN_TEMPLATE_URL: Record<CreativeModel, string> = {
  institucional: OFFICIAL_TEMPLATE_URL,
  marketing: MARKETING_TEMPLATE_URL,
};

export type TextBlock = {
  /** Fração horizontal; usada como centro (align "center") ou início. */
  x?: number;
  align: "center" | "left";
  /** Linha de base do texto (parte inferior das maiúsculas). */
  baselineY: number;
  /** Altura das maiúsculas, em fração da altura do template. */
  capHeight: number;
  /**
   * Altura de REFERÊNCIA (100%) das maiúsculas. Cidades curtas podem
   * crescer até `capHeight` (≈125%) e cidades longas reduzem até
   * `capHeightMin` (≈75%) — sempre na mesma linha de base.
   */
  capHeightRef?: number;
  /**
   * Largura visual desejada da tinta, em fração da largura do template.
   * É ela que define o quanto o texto cresce ou reduz.
   */
  targetWidth?: number;
  /**
   * Altura mínima das maiúsculas. Cidades longas reduzem progressivamente
   * até este limite — nunca abaixo dele.
   */
  capHeightMin?: number;
  maxWidth: number;
  tracking?: number;
  weight: number;
  color: string;
  /** Texto fixo escrito antes do valor variável (ex.: "AGORA EM "). */
  prefix?: string;
  /**
   * Área do placeholder impresso no template. Antes de escrever, o motor
   * limpa essa faixa reproduzindo a cor do próprio template — nenhum
   * elemento gráfico é alterado, apenas o texto de exemplo desaparece.
   */
  clear?: {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    /** Lado do template usado como amostra de cor (padrão: esquerda). */
    sample?: "left" | "right";
  };
};

export type CopyBlock = TextBlock & {
  /** Altura de linha, em fração da altura do template. */
  lineHeight: number;
  /** Máximo de caracteres por linha e de linhas. */
  chars: number;
  lines: number;
};

export type TemplateLayout = {
  /**
   * Área da fotografia da cidade. `x0`/`x1` são opcionais: quando ausentes
   * a fotografia ocupa toda a largura (Modelo A). `film` desliga a película
   * quando o próprio template já traz o tratamento (Modelo B).
   */
  photoArea: { y0: number; y1: number; x0?: number; x1?: number; film?: boolean };
  /** Elemento gráfico preservado por cima da fotografia (selo). */
  badgeArea?: { x0: number; x1: number; y0: number; y1: number };
  city?: TextBlock;
  state?: TextBlock;
  /** Complemento "AGORA EM <CIDADE> - <UF>". */
  tail?: TextBlock;
  /** Rodapé "<CIDADE> - <UF>". */
  footer?: TextBlock;
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

/** Laranja OFICIAL amostrado no próprio template (255, 138, 45). */
export const TEMPLATE_ORANGE = "#FF8A2D";

/**
 * Modelo A — template oficial do Canva (2025 × 3600).
 * O PNG é camada fixa e imutável. Somente dois campos são dinâmicos:
 *  - CAMPO A: cidade principal, centralizada, abaixo de "nossa nova unidade em";
 *  - CAMPO B: "CIDADE - UF" logo após o texto fixo "agora em" (X inicial fixo).
 * Todas as medidas foram lidas diretamente do arquivo oficial em uso.
 */
const INSTITUTIONAL: TemplateLayout = {
  // Janela real da fotografia no arquivo oficial (y 643 → 2465 de 3600).
  photoArea: { x0: 0, x1: 1, y0: 0.1786, y1: 0.6847 },
  // CAMPO A — cidade principal. Y fixo, centro fixo, corpo proporcional
  // com limite máximo (referência TAUBATÉ) e mínimo (cidades longas).
  city: {
    align: "center",
    // Pequeno ajuste vertical: a linha de base desce ~34 px (y = 644 px)
    // e permanece a MESMA para cidade curta, média ou longa.
    baselineY: 0.1789,
    capHeight: 0.04167, // máximo  = 150 px (≈125% da referência)
    capHeightRef: 0.03333, // referência = 120 px (100%)
    capHeightMin: 0.025, // mínimo = 90 px (≈75%)
    targetWidth: 0.39,
    maxWidth: 0.8,
    weight: 700,
    color: TEMPLATE_ORANGE,
  },
  // CAMPO B — continuação da linha fixa "agora em" (termina em x = 588 px).
  // O X inicial é FIXO: a cidade cresce sempre para a direita.
  tail: {
    x: 0.3062, // x = 620 px
    align: "left",
    // Mesmo tipo de ajuste: desce ~20 px (y = 2432 px). "agora em"
    // pertence ao template e não é movido.
    baselineY: 0.6756,
    capHeight: 0.01444, // = 52 px (mesma altura do parágrafo fixo)
    capHeightMin: 0.0105,
    maxWidth: 0.575,
    weight: 700,
    color: TEMPLATE_ORANGE,
  },
};

/**
 * Modelo B — Marketing. Mesma mecânica do Modelo A: o template enviado
 * é preservado integralmente e apenas os campos abaixo são preenchidos.
 */
const MARKETING: TemplateLayout = {
  // Área reservada para a fotografia (moldura tracejada do template).
  // A película já pertence ao próprio arquivo — nada é recriado.
  photoArea: { x0: 0.432, x1: 0.932, y0: 0.151, y1: 0.439, film: false },
  headline: {
    x: 0.0623,
    align: "left",
    baselineY: 0.5937,
    capHeight: 0.0417,
    maxWidth: 0.58,
    lineHeight: 0.0507,
    chars: 16,
    lines: 1,
    weight: 700,
    color: "#F1610C",
    clear: { x0: 0.05, x1: 0.645, y0: 0.5382, y1: 0.6111 },
  },
  subheadline: {
    x: 0.0623,
    align: "left",
    baselineY: 0.632,
    capHeight: 0.0208,
    maxWidth: 0.58,
    lineHeight: 0.03,
    chars: 26,
    lines: 1,
    weight: 700,
    color: "#12275A",
    clear: { x0: 0.05, x1: 0.645, y0: 0.6083, y1: 0.6417 },
  },
  supporting: {
    x: 0.0623,
    align: "left",
    baselineY: 0.682,
    capHeight: 0.0139,
    maxWidth: 0.58,
    lineHeight: 0.0229,
    chars: 44,
    lines: 2,
    weight: 600,
    color: "#12275A",
    clear: { x0: 0.05, x1: 0.63, y0: 0.6597, y1: 0.7118 },
  },
  // "AGORA EM <CIDADE> - <UF>" na linha institucional.
  tail: {
    x: 0.0623,
    align: "left",
    baselineY: 0.7313,
    capHeight: 0.0153,
    maxWidth: 0.58,
    tracking: 0.03,
    weight: 700,
    color: "#F1610C",
    prefix: "AGORA EM ",
    clear: { x0: 0.05, x1: 0.63, y0: 0.7132, y1: 0.7368 },
  },
  // Rodapé laranja: "<CIDADE> - <UF>".
  footer: {
    x: 0.7326,
    align: "left",
    baselineY: 0.9132,
    capHeight: 0.0181,
    maxWidth: 0.232,
    weight: 700,
    color: "#FFFFFF",
    clear: { x0: 0.7253, x1: 0.972, y0: 0.8896, y1: 0.9188, sample: "right" },
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
