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
  const date = typeof value === "string" ? new Date(value) : value;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number(formatted);
}

export function isBusinessDay(isoDate: string, config = RELATIONSHIP_CONFIG): boolean {
  if (config.nonBusinessDays.includes(isoDate)) return false;
  return isBusinessDayIso(isoDate);
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

/** Instante (ISO) correspondente ao início do horário permitido de um dia. */
export function atBusinessStart(isoDate: string, config = RELATIONSHIP_CONFIG): string {
  // A operação está em UTC-3 o ano inteiro; somamos o deslocamento para
  // obter o instante UTC equivalente ao horário local de abertura.
  const [y, m, d] = isoDate.split("-").map(Number);
  const utcHour = config.businessHours.start + 3;
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, utcHour, 0, 0)).toISOString();
}

/** O instante está dentro do horário operacional de um dia útil? */
export function isEligibleMoment(iso: string, config = RELATIONSHIP_CONFIG): boolean {
  if (!isBusinessDay(operationalDate(iso, config), config)) return false;
  const hour = operationalHour(iso, config);
  return hour >= config.businessHours.start && hour < config.businessHours.end;
}

/**
 * Próximo momento em que uma etapa pode ser executada. Nunca antecipa:
 * se o instante já é elegível, ele mesmo é retornado.
 */
export function nextEligibleMoment(iso: string, config = RELATIONSHIP_CONFIG): string {
  if (isEligibleMoment(iso, config)) return iso;
  const date = operationalDate(iso, config);
  const hour = operationalHour(iso, config);
  const sameDayStillPossible =
    isBusinessDay(date, config) && hour < config.businessHours.start;
  const target = sameDayStillPossible ? date : nextBusinessDay(addDays(date, 1), config);
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