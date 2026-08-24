/**
 * JANELA OPERACIONAL E0 (regra §16, aprovada no plano final).
 *
 *   E0: Seg–Sex 07:00–22:30 · Sábado 07:00–12:00 · Domingo sem envio.
 *
 * Fora da janela NADA é disparado: a entrada é enfileirada/adiada e
 * executada na próxima abertura. Regra pura, sem banco e sem canal.
 *
 * Observação histórica: esta função já foi apenas "noturna" e já foi
 * "integral todos os dias". A regra vigente é a §16 acima — alterações
 * de calendário pertencem a este arquivo e aos seus testes.
 *
 * Assinaturas preservadas: os consumidores chamam sem argumento
 * (instante atual) — `date` é opcional apenas para testes.
 */

export const E0_WINDOW_RESUME_MIN = 70;

const OPEN_HOUR = 7;
const CLOSE_HOUR = 22;
const CLOSE_MINUTE = 30;
const SATURDAY_CLOSE_HOUR = 12;

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Dia da semana: 0 = domingo, 6 = sábado (hora local). */
const weekdayOf = (d: Date) => d.getDay();

/**
 * Verdadeiro quando a janela E0 está FECHADA no instante informado:
 * madrugada/fechamento (qualquer dia), sábado a partir das 12:00 e
 * domingo o dia inteiro.
 */
export function isE0Blocked(date: Date = new Date()): boolean {
  const day = weekdayOf(date);
  if (day === 0) return true; // domingo — sem envio
  const minutes = minutesOfDay(date);
  if (day === 6) return minutes < OPEN_HOUR * 60 || minutes >= SATURDAY_CLOSE_HOUR * 60;
  return minutes < OPEN_HOUR * 60 || minutes >= CLOSE_HOUR * 60 + CLOSE_MINUTE;
}

/** Nome histórico mantido para os consumidores existentes. */
export const isE0NightWindow = isE0Blocked;

/**
 * Próximo instante em que a janela E0 estará aberta a partir de `date`.
 * Se já estiver aberta, devolve o próprio instante.
 */
export function nextE0Moment(date: Date = new Date()): Date {
  const candidate = new Date(date.getTime());
  for (let i = 0; i < 10; i += 1) {
    const day = weekdayOf(candidate);
    const minutes = minutesOfDay(candidate);
    if (!isE0Blocked(candidate)) return candidate;
    if (day === 0) {
      // Domingo → segunda-feira 07:00.
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(OPEN_HOUR, 0, 0, 0);
      continue;
    }
    const closeMinutes =
      day === 6 ? SATURDAY_CLOSE_HOUR * 60 : CLOSE_HOUR * 60 + CLOSE_MINUTE;
    if (minutes >= closeMinutes) {
      // Após o fechamento do dia → próxima abertura (o laço pula o domingo).
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(OPEN_HOUR, 0, 0, 0);
      continue;
    }
    if (minutes < OPEN_HOUR * 60) {
      candidate.setHours(OPEN_HOUR, 0, 0, 0);
      continue;
    }
    // Caso residual (não deveria ocorrer): avança um dia por segurança.
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(OPEN_HOUR, 0, 0, 0);
  }
  return candidate;
}

/** Texto oficial do adiamento — auditado no evento `e0_adiada`. */
export function nightDeferralReason(at: Date = new Date()): string {
  const resume = nextE0Moment(at);
  const hh = String(resume.getHours()).padStart(2, "0");
  const mm = String(resume.getMinutes()).padStart(2, "0");
  const day = String(resume.getDate()).padStart(2, "0");
  const month = String(resume.getMonth() + 1).padStart(2, "0");
  return `E0 adiada — fora da janela operacional (§16: Seg–Sex 07:00–22:30, Sáb 07:00–12:00, Dom sem envio). Retomada automática em ${day}/${month} às ${hh}:${mm}.`;
}
