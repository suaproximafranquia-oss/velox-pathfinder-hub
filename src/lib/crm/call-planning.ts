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
/**
 * As funções de calendário são locais e puras para evitar dependência
 * circular com o motor de cadência (que consome este planejamento).
 */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

function nextBusinessDay(isoDate: string): string {
  let date = isoDate;
  for (let i = 0; i < 30; i += 1) {
    const [y, m, d] = date.split("-").map(Number);
    const weekday = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) return date;
    date = addDays(date, 1);
  }
  return date;
}

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
