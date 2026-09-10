/** Vínculo da RE com a instância existente; ordem interna continua 1/2/3. */
export const REENTRY_ORDER_SPAN = 100;
export function reentryQueueOrder(sequence: number, order: number): number {
  return sequence * REENTRY_ORDER_SPAN + order;
}
export function reentryInternalOrder(step: string, order: number): number {
  return /^RE[0-3]$/.test(step) && order >= REENTRY_ORDER_SPAN ? order % REENTRY_ORDER_SPAN : order;
}
export function belongsToReentryCycle(step: string, order: number, sequence: number): boolean {
  return /^RE[0-3]$/.test(step) && Math.floor(order / REENTRY_ORDER_SPAN) === sequence;
}