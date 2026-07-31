/**
 * Validação única dos campos de horário do Portal.
 *
 * Regra oficial: hora entre 00 e 23, minuto entre 00 e 59. Qualquer
 * outro valor é bloqueado antes de chegar às regras de negócio.
 */
export const TIME_PATTERN = "^([01][0-9]|2[0-3]):[0-5][0-9]$";

/** Props padrão para todo `<input type="time">` do sistema. */
export const TIME_INPUT_PROPS = {
  type: "time" as const,
  min: "00:00",
  max: "23:59",
  step: 60,
  pattern: TIME_PATTERN,
};

export function isValidTimeValue(value: string): boolean {
  return new RegExp(TIME_PATTERN).test(value.trim());
}

/** Normaliza a digitação, descartando valores fora do intervalo válido. */
export function sanitizeTimeValue(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return isValidTimeValue(v) ? v : v.slice(0, 5);
}
