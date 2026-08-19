/**
 * PREFERÊNCIA DE CALENDÁRIO ENTRE LIGAÇÕES E MENSAGENS.
 *
 * Os dois motores são INDEPENDENTES: uma ligação nunca recalcula a
 * cadência de mensagens e uma mensagem nunca recalcula a de ligações.
 * Esta função é apenas uma preferência de planejamento — quando existe
 * uma alternativa próxima em dia útil, a ligação prefere um dia em que
 * não haja mensagem prevista. Se não houver alternativa, a coincidência
 * é permitida e nada quebra.
 */
import { addDays, nextBusinessDay } from "./cadence";

export type CallDatePreference = {
  date: string;
  shifted: boolean;
  reason: string;
};

export function preferNonCollidingCallDate(
  dueDate: string,
  messageDates: readonly string[],
  options: { maxShiftBusinessDays?: number } = {},
): CallDatePreference {
  const planned = new Set(messageDates.filter(Boolean));
  if (!planned.has(dueDate)) {
    return { date: dueDate, shifted: false, reason: "Sem mensagem prevista para o dia." };
  }
  const maxShift = options.maxShiftBusinessDays ?? 1;
  let candidate = dueDate;
  for (let i = 0; i < maxShift; i += 1) {
    candidate = nextBusinessDay(addDays(candidate, 1));
    if (!planned.has(candidate)) {
      return {
        date: candidate,
        shifted: true,
        reason: `Mensagem prevista em ${dueDate} — ligação preferida no próximo dia útil livre.`,
      };
    }
  }
  return {
    date: dueDate,
    shifted: false,
    reason: "Coincidência inevitável — a ligação permanece no dia previsto.",
  };
}
