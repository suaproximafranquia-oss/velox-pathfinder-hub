/**
 * Normalização das chaves de módulo do Portal.
 *
 * A Home abre os módulos pelas chaves do registro visual
 * (`PORTAL_MODULES`), mas o servidor contabiliza engajamento por chaves
 * canônicas. Sem esta tradução o Material Institucional (`universo`)
 * chegava ao servidor como módulo desconhecido e era descartado — a
 * origem do "Sem acesso registrado" na Ficha do Investidor.
 *
 * Fonte única: qualquer superfície que precise falar de módulo deve
 * passar por aqui.
 */
export type CanonicalModule =
  | "manual"
  | "material"
  | "simulador"
  | "ia"
  | "portal"
  | "revista"
  | "estrutura"
  | "principios";

const ALIASES: Record<string, CanonicalModule> = {
  manual: "manual",
  material: "material",
  universo: "material",
  simulador: "simulador",
  simulator: "simulador",
  calculadora: "simulador",
  ia: "ia",
  portal: "portal",
  revista: "revista",
  magazine: "revista",
  estrutura: "estrutura",
  sede: "estrutura",
  principios: "principios",
  cultura: "principios",
};

export function canonicalModule(key?: string | null): CanonicalModule | null {
  if (!key) return null;
  return ALIASES[key.trim().toLowerCase()] ?? null;
}

/** Rótulo oficial de cada módulo — usado em Ficha, Jornada e Engajamento. */
export const CANONICAL_MODULE_LABEL: Record<CanonicalModule, string> = {
  manual: "Manual do Investidor",
  material: "Material Institucional",
  simulador: "Simulador Inteligente",
  ia: "Assistente de IA",
  portal: "Portal",
  revista: "Revista Velox",
  estrutura: "Nossa Estrutura",
  principios: "Cultura Velox",
};
