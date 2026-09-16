/**
 * Integração do encerramento operacional do Workspace com a régua V2.
 *
 * `closed_at` continua sendo a fonte persistida do estado do card. O motivo
 * abaixo identifica somente as ações neutralizadas por esse encerramento:
 * elas permanecem no histórico, mas não contam como execução na retomada.
 */
export const NEGOTIATION_CLOSED_CANCEL_REASON = "manual_negotiation_closed";

export const CADENCE_CONTROLLABLE_LEAD_SCOPES = new Set(["portal", "tiktok", "meta"]);

export function supportsWorkspaceCadenceControl(scope: string | null | undefined): boolean {
  return CADENCE_CONTROLLABLE_LEAD_SCOPES.has(String(scope ?? "").toLowerCase());
}

export function isNeutralizedCadenceCancellation(
  status: string,
  cancelReason: string | null | undefined,
): boolean {
  return (
    status === "CANCELLED" &&
    (cancelReason === "undo_call_outcome" ||
      cancelReason === NEGOTIATION_CLOSED_CANCEL_REASON)
  );
}