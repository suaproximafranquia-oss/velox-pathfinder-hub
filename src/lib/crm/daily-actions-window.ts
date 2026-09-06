/**
 * JANELA OPERACIONAL DA AÇÃO DO DIA (camada pura).
 *
 * Regra única de execução manual, em America/Sao_Paulo:
 *   • segunda a sexta: 06:00 às 22:00;
 *   • sábado:          06:00 às 17:00;
 *   • domingo:         sem execução.
 *
 * Fora da janela a pendência CONTINUA existindo (nada é apagado nem
 * reclassificado): apenas a execução fica indisponível até a próxima
 * abertura. Feriado segue a regra do dia da semana — não há exceção.
 *
 * Esta janela é da EXECUÇÃO MANUAL. Ela não altera a janela de envio do
 * motor (E0/cadência), que permanece intacta em `relationship/config`.
 */
import { OPERATIONAL_TIME_ZONE } from "@/lib/crm/daily-actions";

export type OperationalWindow = { open: boolean; label: string; nextLabel: string | null };

/** Dia da semana (0 = domingo) e minutos do dia, em horário operacional. */
function operationalParts(value: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATIONAL_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(get("hour")) % 24;
  return { weekday: map[get("weekday")] ?? 0, minutes: hour * 60 + Number(get("minute")) };
}

/** Faixa do dia da semana, em minutos; `null` quando não há execução. */
export function windowForWeekday(weekday: number): { start: number; end: number } | null {
  if (weekday === 0) return null;
  if (weekday === 6) return { start: 6 * 60, end: 17 * 60 };
  return { start: 6 * 60, end: 22 * 60 };
}

const NEXT_LABEL: Record<number, string> = {
  0: "segunda-feira, a partir das 06:00",
  1: "terça-feira, a partir das 06:00",
  2: "quarta-feira, a partir das 06:00",
  3: "quinta-feira, a partir das 06:00",
  4: "sexta-feira, a partir das 06:00",
  5: "sábado, a partir das 06:00",
  6: "segunda-feira, a partir das 06:00",
};

/** Estado da janela para um instante — usado pela interface e pelo servidor. */
export function resolveOperationalWindow(now: Date = new Date()): OperationalWindow {
  const { weekday, minutes } = operationalParts(now);
  const range = windowForWeekday(weekday);
  const label =
    weekday === 0
      ? "Domingo — sem execução"
      : weekday === 6
        ? "Sábado — 06:00 às 17:00"
        : "Segunda a sexta — 06:00 às 22:00";

  if (range && minutes >= range.start && minutes < range.end) {
    return { open: true, label, nextLabel: null };
  }

  const next =
    range && minutes < range.start
      ? "hoje, a partir das 06:00"
      : (NEXT_LABEL[weekday] ?? "a próxima janela operacional");
  return { open: false, label, nextLabel: next };
}
