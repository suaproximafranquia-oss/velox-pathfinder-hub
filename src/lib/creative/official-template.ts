/**
 * TEMPLATE OFICIAL — Modelo A (Institucional).
 *
 * O layout é permanente e imutável: o arquivo oficial anexado pela
 * diretoria é a única base da peça. Apenas três elementos variam —
 * fotografia da cidade, nome da cidade e UF (além da referência da
 * cidade no texto institucional). Todas as coordenadas são frações
 * (0 a 1) medidas sobre o arquivo oficial (941 x 1672).
 */
import templateAsset from "@/assets/velox-template-oficial.png.asset.json";

export const OFFICIAL_TEMPLATE_URL = (templateAsset as { url: string }).url;

/** Área superior reservada à fotografia (do topo até o azul sólido). */
export const PHOTO_AREA = { y0: 0, y1: 0.6 } as const;

/** Selo "Vem Aí — Nova Unidade": preservado por cima da fotografia. */
export const BADGE_AREA = { x0: 0.298, x1: 0.722, y0: 0.008, y1: 0.114 } as const;

/** Bloco do nome da cidade (texto principal). */
export const CITY_BLOCK = {
  centerY: 0.4913,
  capHeight: 0.0455,
  maxWidth: 0.94,
  color: "#F26A12",
} as const;

/** Bloco do estado por extenso, abaixo da cidade. */
export const STATE_BLOCK = {
  centerY: 0.5645,
  capHeight: 0.0168,
  maxWidth: 0.86,
  tracking: 0.34,
  color: "#FFFFFF",
} as const;

/** Complemento "AGORA EM <CIDADE> - <UF>" na última linha do parágrafo. */
export const TAIL_TEXT = {
  x: 0.252,
  centerY: 0.6607,
  capHeight: 0.0132,
  maxWidth: 0.72,
  color: "#FFFFFF",
} as const;

export const TEMPLATE_FONT =
  '"Arial Black", "Archivo Black", "Helvetica Neue", Helvetica, Arial, sans-serif';

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
