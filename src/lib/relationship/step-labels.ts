/**
 * CAMADA DE RÓTULOS DAS ETAPAS (apresentação apenas).
 *
 * A CHAVE TÉCNICA NUNCA MUDA. `E20` continua sendo `E20` no banco, na
 * fila, nos snapshots e no histórico — o que esta camada define é
 * apenas COMO a etapa aparece na interface. O rótulo é editável pela
 * Gestão na Biblioteca (campo `title` da versão ativa) e, quando não
 * houver rótulo salvo, vale o padrão abaixo.
 */

export const DEFAULT_STEP_LABELS: Record<string, string> = {
  E20: "E6 — Apresentação Digital",
  E27: "E27 — Checkpoint da Apresentação Digital",
  FINALIZACAO: "Finalização do ciclo",
  RESPOSTA_AUTOMATICA: "Resposta automática — janela de 24h",
};

/** Rótulo visível de uma etapa. `override` é o título salvo na Biblioteca. */
export function stepDisplayLabel(stepKey: string, override?: string | null): string {
  const custom = (override ?? "").trim();
  if (custom) return custom;
  return DEFAULT_STEP_LABELS[stepKey] ?? stepKey;
}
