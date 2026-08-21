/**
 * JANELA OPERACIONAL DA E0 (madrugada).
 *
 * A E0 continua sendo o primeiro contato automático do lead novo. O
 * HORÁRIO permitido NÃO é uma regra própria da E0: ele vem da janela
 * única do Motor de Relacionamento (`RELATIONSHIP_CONFIG.businessHours`,
 * hoje 07:00–22:30). Fora dela nada é entregue — a E0 fica pendente e é
 * executada na abertura seguinte.
 *
 * Regra pura, sem banco e sem canal: quem decide é o servidor/motor.
 */
import { RELATIONSHIP_CONFIG } from "@/lib/relationship/config";

const TIME_ZONE = RELATIONSHIP_CONFIG.timeZone;
/** A operação está em UTC-3 o ano inteiro. */
const UTC_OFFSET_HOURS = 3;

/** Início do bloqueio noturno (fim da janela central, 22:30). */
export const E0_NIGHT_START_MINUTES = Math.round(RELATIONSHIP_CONFIG.businessHours.end * 60);
/** Abertura da janela operacional da E0 (início da janela central, 07:00). */
export const E0_WINDOW_OPEN_MINUTES = Math.round(RELATIONSHIP_CONFIG.businessHours.start * 60);


function localParts(value: string | Date): { date: string; minutes: number } {
  const instant = typeof value === "string" ? new Date(value) : value;
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => formatted.find((p) => p.type === type)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
  };
}

/** O instante está dentro da madrugada bloqueada para a E0? */
export function isE0NightWindow(value: string | Date = new Date()): boolean {
  const { minutes } = localParts(value);
  return minutes >= E0_NIGHT_START_MINUTES || minutes < E0_WINDOW_OPEN_MINUTES;
}

function addCalendarDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
}

/**
 * Próximo instante em que a E0 pode ser executada. Fora da madrugada é
 * o próprio instante; dentro dela, as 07:00 da próxima abertura.
 */
export function nextE0Moment(value: string | Date = new Date()): string {
  const instant = typeof value === "string" ? new Date(value) : value;
  if (!isE0NightWindow(instant)) return instant.toISOString();
  const { date, minutes } = localParts(instant);
  const target = minutes >= E0_NIGHT_START_MINUTES ? addCalendarDay(date) : date;
  const [y, m, d] = target.split("-").map(Number);
  return new Date(
    Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, UTC_OFFSET_HOURS, 0, 0, 0) +
      E0_WINDOW_OPEN_MINUTES * 60_000,
  ).toISOString();
}


/** Texto padrão do adiamento — usado em eventos e auditoria. */
export function nightDeferralReason(value: string | Date = new Date()): string {
  return `E0 recebida na madrugada (22:30–06:59). Envio adiado para ${nextE0Moment(value)} (07:00 da operação).`;
}
