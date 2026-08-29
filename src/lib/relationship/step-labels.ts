/**
 * CAMADA DE RÓTULOS DAS ETAPAS (apresentação apenas).
 *
 * A CHAVE TÉCNICA NUNCA MUDA. `E20` continua sendo `E20` no banco, na
 * fila, nos snapshots e no histórico — o que esta camada define é
 * apenas COMO a etapa aparece na interface. O rótulo é editável pela
 * Gestão na Biblioteca (campo `title` da versão ativa) e, quando não
 * houver rótulo salvo, vale o padrão abaixo.
 *
 * FONTE ÚNICA: esta é a única lista de rótulos do sistema. A Biblioteca
 * de Conteúdos, as Mensagens do Motor e os diagnósticos leem daqui.
 */

export const DEFAULT_STEP_LABELS: Record<string, string> = {
  E0: "E0 — Primeiro contato",
  E0_V1: "E0 V1 — Primeiro contato (veio do Portal)",
  E1: "E1 — Primeiro acompanhamento",
  E3: "E3 — Segundo acompanhamento",
  E4: "E4 — Acompanhamento mais firme",
  E12: "E12 — Encerramento do fluxo sem resposta",
  E30: "E30 — Recontato tardio",
  V3: "V3 — Visualizou e não respondeu",
  V4: "V4 — Encerramento da interação visualizada",
  R1: "R1 — Primeira tentativa após desaparecimento",
  R2: "R2 — Segunda tentativa após desaparecimento",
  R3: "R3 — Interrupção das tentativas",
  RE0: "RE0 — Reentrada: retomada do contato",
  RE1: "RE1 — Reentrada: como avaliar uma franquia",
  RE2: "RE2 — Reentrada: estrutura e suporte",
  RE3: "RE3 — Reentrada: encerramento",
  RF0: "RF0 — Relacionamento esfriado: retomada",
  RF1: "RF1 — Relacionamento esfriado: encerramento",
  E20: "E6 — Apresentação Digital",
  E27: "E7 — Checkpoint da Apresentação Digital",
  FINALIZACAO: "Finalização do ciclo",
  RESPOSTA_AUTOMATICA: "Resposta automática — janela de 24h",
};

/**
 * CÓDIGO FUNCIONAL CURTO (o que o usuário lê quando não cabe o rótulo
 * inteiro). A chave técnica histórica continua existindo no banco: aqui
 * apenas traduzimos `E20 → E6` e `E27 → E7` na apresentação.
 */
const STEP_DISPLAY_CODES: Record<string, string> = {
  E20: "E6",
  E27: "E7",
};

export function stepShortCode(stepKey: string): string {
  return STEP_DISPLAY_CODES[stepKey] ?? stepKey;
}

/** Rótulo visível de uma etapa. `override` é o título salvo na Biblioteca. */
export function stepDisplayLabel(stepKey: string, override?: string | null): string {
  const custom = (override ?? "").trim();
  if (custom) return custom;
  return DEFAULT_STEP_LABELS[stepKey] ?? stepShortCode(stepKey);
}
