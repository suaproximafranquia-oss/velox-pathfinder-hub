/**
 * DECISÃO EDITORIAL PÓS-LIGAÇÃO — regra pura da Financeira /f.
 *
 * A etapa da fila nunca muda. Esta função decide somente qual chave da
 * Biblioteca fornece o texto exibido e congelado após o desfecho da ligação.
 */
export const POST_CALL_MATERIAL_STEP = "ENVIO_MATERIAL_POS_CONTATO";

export const POST_CALL_MATERIAL_SOURCE_STEPS = [
  "E0",
  "E1",
  "E2",
  "V2",
  "E3",
  "V3",
  "E4",
  "E7",
  "R1",
  "R2",
  "RE0",
  "RE1",
  "RE3",
] as const;

export type PostCallOutcome = "SIM" | "NAO" | null | undefined;

/** SIM/ATENDEU troca somente a fonte editorial; NÃO preserva a etapa. */
export function resolvePostCallLibraryStep(
  step: string,
  outcome: PostCallOutcome,
): string {
  const key = String(step ?? "").trim().toUpperCase();
  if (
    outcome === "SIM" &&
    (POST_CALL_MATERIAL_SOURCE_STEPS as readonly string[]).includes(key)
  ) {
    return POST_CALL_MATERIAL_STEP;
  }
  return key;
}