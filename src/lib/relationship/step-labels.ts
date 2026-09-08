/**
 * CAMADA DE RÓTULOS DAS ETAPAS (apresentação apenas).
 *
 * A CHAVE TÉCNICA É A IDENTIDADE: na operação atual da Financeira /f ela
 * é E0–E8, R1–R4, RE0–RE3. O rótulo é editável pela Gestão na Biblioteca
 * (campo `title` da versão ativa) e, quando não houver rótulo salvo — ou
 * quando o rótulo salvo carregar o código de OUTRA etapa (resíduo
 * histórico) — vale o padrão editorial abaixo.
 *
 * Chaves históricas (E12, E20, E27, FINALIZACAO, V3, V4…)
 * continuam gravadas no banco e são rotuladas como histórico; nunca como
 * identidade de uma etapa atual.
 */
import { HISTORICAL_STEP_TO_CURRENT } from "./operational-steps";

export const DEFAULT_STEP_LABELS: Record<string, string> = {
  /* MAPA EDITORIAL ATUAL — Fluxo E */
  E0: "E0 — Primeiro contato",
  E1: "E1 — Primeiro acompanhamento",
  E2: "E2 — Segundo acompanhamento",
  E3: "E3 — Terceiro acompanhamento",
  E4: "E4 — Oferta da apresentação digital",
  E5: "E5 — Apresentação digital / entrega manual do material",
  E6: "E6 — Acompanhamento da apresentação digital",
  E7: "E7 — Última tentativa de contato / definição sobre continuidade",
  E8: "E8 — Finalização",
  /* Fluxo R */
  R1: "R1 — Primeira tentativa após desaparecimento",
  R2: "R2 — Segunda tentativa após desaparecimento",
  R3: "R3 — Interrupção das tentativas",
  R4: "R4 — Finalização do reengajamento",
  /* Fluxo RE */
  RE0: "RE0 — Reentrada: retomada do contato",
  RE1: "RE1 — Reentrada: como avaliar uma franquia",
  RE2: "RE2 — Reentrada: estrutura e suporte",
  RE3: "RE3 — Reentrada: encerramento",
  /* Fluxo RF — relacionamento esfriado (última camada de reaproximação) */
  RF0: "RF0 — Relacionamento esfriado: retomada",
  RF1: "RF1 — Relacionamento esfriado: encerramento",
  RESPOSTA_AUTOMATICA: "Resposta automática — janela de 24h",

  /* CHAVES HISTÓRICAS — apenas para leitura de registros antigos. */
  E0_V1: "E0 V1 (histórico) — Primeiro contato vindo do Portal",
  E12: "E12 (histórico) — Encerramento do fluxo sem resposta",
  E20: "E20 (histórico) — Apresentação Digital",
  E27: "E27 (histórico) — Checkpoint da Apresentação Digital",
  E30: "E30 (histórico) — Recontato tardio",
  V3: "V3 (histórico) — Visualizou e não respondeu",
  V4: "V4 (histórico) — Encerramento da interação visualizada",
  FINALIZACAO: "FINALIZACAO (histórico) — Finalização do ciclo",
};

/**
 * CÓDIGO CURTO para apresentar REGISTROS ANTIGOS (histórico de envios,
 * jornada) na nomenclatura atual: E12 → E3, E20 → E6, E27 → E7. A chave
 * gravada não muda; só a leitura.
 */
export function stepShortCode(stepKey: string): string {
  return HISTORICAL_STEP_TO_CURRENT[stepKey] ?? stepKey;
}

/** Prefixo "CÓDIGO —" no início de um título (E3 —, RE1 -, ER0 -…). */
const CODE_PREFIX = /^\s*([A-Z]{1,3}\d{0,2})\s*[—–-]\s*/;

/**
 * Um título salvo só é aceito como rótulo da etapa quando NÃO começa com
 * o código de outra etapa. Títulos herdados de deslocamentos históricos
 * ("E2 — …" gravado em E3, "RE1 — …" gravado em E7) não contaminam a
 * identidade atual: caem no padrão editorial. O texto gravado permanece
 * intacto no banco.
 */
export function titleMatchesStep(stepKey: string, title: string | null | undefined): boolean {
  const custom = (title ?? "").trim();
  if (!custom) return false;
  const match = CODE_PREFIX.exec(custom);
  if (!match) return true;
  return match[1]!.toUpperCase() === stepKey.trim().toUpperCase();
}

/** Rótulo visível de uma etapa. `override` é o título salvo na Biblioteca. */
export function stepDisplayLabel(stepKey: string, override?: string | null): string {
  if (titleMatchesStep(stepKey, override)) return (override ?? "").trim();
  return DEFAULT_STEP_LABELS[stepKey] ?? stepKey;
}
