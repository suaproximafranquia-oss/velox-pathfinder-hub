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
    // Continuação EXATA da linha "AGORA EM" já impressa no template.
    // Medido no arquivo oficial em uso: a palavra "EM" termina em
    // x = 0.2444 e a linha de base do parágrafo está em y = 0.6851.
    // O prefixo de espaço cria o intervalo tipográfico entre "EM" e a
    // cidade, mantendo tudo em UMA única linha contínua.
    x: 0.2560,
    prefix: " ",
    align: "left",
    baselineY: 0.6851,
    capHeight: 0.0131,
    maxWidth: 0.7,
    tracking: 0.02,
    weight: 700,
    // "AGORA EM" já está impresso em laranja no template; a parte dinâmica
    // (CIDADE - UF) acompanha o branco do restante do texto institucional.
    color: "#FFFFFF",
    // Apaga apenas o exemplo laranja impresso após "AGORA EM" (amostra de
    // cor colhida à direita, longe do texto institucional laranja).
    clear: { x0: 0.2530, x1: 0.62, y0: 0.6665, y1: 0.6905, sample: "right" },
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
