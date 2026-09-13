/**
 * Liberação excepcional e autoexpirável da execução manual no `/f`.
 * Não participa do calendário, da montagem da fila nem da classificação.
 */
const START_AT = Date.parse("2026-09-13T00:00:00-03:00");
export const TEMPORARY_DAILY_ACTIONS_RELEASE_EXPIRES_AT = Date.parse(
  "2026-09-14T00:00:00-03:00",
);

export function isTemporaryDailyActionsReleaseActive(now: Date = new Date()): boolean {
  const instant = now.getTime();
  return instant >= START_AT && instant < TEMPORARY_DAILY_ACTIONS_RELEASE_EXPIRES_AT;
}