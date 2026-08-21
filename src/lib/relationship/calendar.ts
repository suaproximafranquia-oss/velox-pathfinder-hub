/**
 * CAMADA CENTRAL DE TEMPO (COMANDO 2A §9, §11).
 *
 * Data, hora, dia da semana, dia útil, horário permitido e próximo
 * momento elegível. Nenhuma etapa recalcula isso por conta própria.
 *
 * Os utilitários de data de calendário são reaproveitados do motor
 * comercial existente para não haver duas definições de "dia útil".
 */
import {
  addBusinessDays as addBusinessDaysIso,
  addDays,
  commercialDate,
  isBusinessDay as isBusinessDayIso,
  nextBusinessDay as nextBusinessDayIso,
} from "@/lib/crm/cadence";
import { RELATIONSHIP_CONFIG, type RelationshipConfig } from "./config";

export { addDays };

/** Data operacional (YYYY-MM-DD) no fuso da operação. */
export function operationalDate(value: string | Date, config = RELATIONSHIP_CONFIG): string {
  void config;
  return commercialDate(value);
}

/** Hora local (0-23) da operação para um instante. */
export function operationalHour(value: string | Date, config = RELATIONSHIP_CONFIG): number {
  return Math.floor(operationalMinutes(value, config) / 60);
}

/**
 * Minutos locais decorridos desde a meia-noite. É a precisão exigida
 * pela janela oficial, que termina às 22:30 — hora cheia não basta.
 */
export function operationalMinutes(value: string | Date, config = RELATIONSHIP_CONFIG): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return (get("hour") % 24) * 60 + get("minute");
}


export function isBusinessDay(isoDate: string, config = RELATIONSHIP_CONFIG): boolean {
  if (config.nonBusinessDays.includes(isoDate)) return false;
  return isBusinessDayIso(isoDate);
}

/** Dia da semana (0 = domingo) de uma data ISO. */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/**
 * Janela de ENVIO de mensagens do dia (COMANDO 3D §8, §11).
 *
 * Segunda a sexta: horário operacional cheio. Sábado: janela própria.
 * Domingo e feriados: nenhum envio — a etapa é apenas deslocada, nunca
 * perdida nem substituída pela seguinte (§9, §10).
 */
export function messagingHours(
  isoDate: string,
  config = RELATIONSHIP_CONFIG,
): { start: number; end: number } | null {
  if (config.nonBusinessDays.includes(isoDate)) return null;
  const weekday = weekdayOf(isoDate);
  if (weekday === 0) return null;
  if (weekday === 6) return config.saturdayHours;
  return config.businessHours;
}

export function isMessagingDay(isoDate: string, config = RELATIONSHIP_CONFIG): boolean {
  return messagingHours(isoDate, config) !== null;
}

/** Próximo dia (inclusive?) em que existe janela de envio. */
export function nextMessagingDay(isoDate: string, config = RELATIONSHIP_CONFIG): string {
  let date = isoDate;
  for (let i = 0; i < 30 && !isMessagingDay(date, config); i += 1) date = addDays(date, 1);
  return date;
}

export function nextBusinessDay(isoDate: string, config = RELATIONSHIP_CONFIG): string {
  let date = nextBusinessDayIso(isoDate);
  for (let i = 0; i < 30 && !isBusinessDay(date, config); i += 1) {
    date = nextBusinessDayIso(addDays(date, 1));
  }
  return date;
}

export function addBusinessDays(
  isoDate: string,
  days: number,
  config = RELATIONSHIP_CONFIG,
): string {
  let date = nextBusinessDay(isoDate, config);
  for (let i = 0; i < days; i += 1) date = nextBusinessDay(addDays(date, 1), config);
  return addBusinessDaysIso(date, 0);
}

/** Instante (ISO) correspondente ao início da janela de envio de um dia. */
export function atBusinessStart(isoDate: string, config = RELATIONSHIP_CONFIG): string {
  // A operação está em UTC-3 o ano inteiro; somamos o deslocamento para
  // obter o instante UTC equivalente ao horário local de abertura.
  const [y, m, d] = isoDate.split("-").map(Number);
  const window = messagingHours(isoDate, config) ?? config.businessHours;
  const utcMinutes = Math.round(window.start * 60) + 3 * 60;
  return new Date(
    Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, utcMinutes, 0),
  ).toISOString();
}

/** O instante está dentro da janela de envio permitida? */
export function isEligibleMoment(iso: string, config = RELATIONSHIP_CONFIG): boolean {
  const window = messagingHours(operationalDate(iso, config), config);
  if (!window) return false;
  const minutes = operationalMinutes(iso, config);
  return minutes >= window.start * 60 && minutes < window.end * 60;
}

/** Passou o fechamento operacional do dia (§3)? */
export function isAfterDailyClosing(iso: string, config = RELATIONSHIP_CONFIG): boolean {
  return operationalMinutes(iso, config) >= config.dailyClosingHour * 60;
}

/**
 * Próximo momento em que uma etapa pode ser executada. Nunca antecipa:
 * se o instante já é elegível, ele mesmo é retornado. Fora da janela a
 * etapa NÃO se perde — ela é empurrada para a próxima abertura.
 */
export function nextEligibleMoment(iso: string, config = RELATIONSHIP_CONFIG): string {
  if (isEligibleMoment(iso, config)) return iso;
  const date = operationalDate(iso, config);
  const minutes = operationalMinutes(iso, config);
  const window = messagingHours(date, config);
  const sameDayStillPossible = window !== null && minutes < window.start * 60;
  const target = sameDayStillPossible ? date : nextMessagingDay(addDays(date, 1), config);
  return atBusinessStart(target, config);
}


/**
 * Vencimento de uma etapa: N dias úteis após a referência, sempre
 * reagendado para o próximo dia útil/horário permitido. A etapa é
 * preservada — um fim de semana nunca transforma E1 em E3.
 */
export function dueMomentAfterBusinessDays(
  referenceIso: string,
  businessDays: number,
  config: RelationshipConfig = RELATIONSHIP_CONFIG,
): string {
  const referenceDate = operationalDate(referenceIso, config);
  const dueDate =
    businessDays <= 0
      ? nextBusinessDay(referenceDate, config)
      : addBusinessDays(referenceDate, businessDays, config);
  if (dueDate === referenceDate && isEligibleMoment(referenceIso, config)) return referenceIso;
  return nextEligibleMoment(atBusinessStart(dueDate, config), config);
}