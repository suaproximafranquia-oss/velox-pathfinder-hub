/**
 * CLASSIFICAÇÃO DE ATRASO DA AÇÃO DO DIA (camada pura).
 *
 * "Atrasado" NÃO é tempo corrido: é a obrigação que já teve um DIA ÚTIL
 * inteiro disponível e não foi concluída. Sábado, domingo, feriado
 * operacional e o período fora do expediente não produzem atraso.
 *
 * Expediente considerado: dias úteis a partir das 09:00; obrigação que
 * chega depois das 17:30 fica disponível no próximo dia útil.
 *
 * Isto NÃO altera janela de envio nem cadência — apenas a classificação
 * exibida na Ação do Dia.
 */
import { addDays, isBusinessDay, operationalDate, operationalMinutes } from "@/lib/relationship/calendar";

export const WORKDAY_START_HOUR = 9;
/** Fim do expediente operacional: 17:30 (em minutos desde a meia-noite). */
export const WORKDAY_END_MINUTES = 17 * 60 + 30;

/** Próximo dia útil, incluindo a própria data quando ela já é útil. */
export function businessDayOnOrAfter(isoDate: string): string {
  let date = isoDate;
  for (let i = 0; i < 30 && !isBusinessDay(date); i += 1) date = addDays(date, 1);
  return date;
}

/** Dia útil corrente: hoje, se útil; senão o último dia útil anterior. */
export function businessDayOnOrBefore(isoDate: string): string {
  let date = isoDate;
  for (let i = 0; i < 30 && !isBusinessDay(date); i += 1) date = addDays(date, -1);
  return date;
}

/**
 * Primeiro dia útil em que a obrigação fica disponível para atendimento.
 * `arrivalIso` é o instante de origem (criação/vencimento).
 */
export function availabilityDate(arrivalIso: string): string {
  const date = operationalDate(arrivalIso);
  const minutes = operationalMinutes(arrivalIso);
  if (isBusinessDay(date) && minutes < WORKDAY_END_MINUTES) return date;
  return businessDayOnOrAfter(addDays(date, 1));
}


/** Disponibilidade de obrigações que só têm data (sem horário de origem). */
export function availabilityFromDate(dueDate: string): string {
  return businessDayOnOrAfter(dueDate);
}

/**
 * Atrasada quando o dia útil de disponibilidade já ficou para trás em
 * relação ao dia útil corrente.
 */
export function isOverdueByBusinessDays(readyDate: string, nowIso: string): boolean {
  if (!readyDate) return false;
  return readyDate < businessDayOnOrBefore(operationalDate(nowIso));
}
