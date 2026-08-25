/**
 * JANELA OPERACIONAL E0 (regra §16, aprovada no plano final).
 *
 *   E0: Seg–Sex 07:00–22:30 · Sábado 07:00–12:00 · Domingo sem envio.
 *
 * Fora da janela NADA é disparado: a entrada é enfileirada/adiada e
 * executada na próxima abertura. Regra pura, sem banco e sem canal.
 *
 * FUSO DA OPERAÇÃO (correção definitiva): a regra é SEMPRE avaliada em
 * America/Sao_Paulo, independentemente do fuso do processo. O servidor
 * roda em UTC — ler `date.getHours()` fazia a janela 07:00–22:30 valer
 * como 04:00–19:30 no horário de Brasília, o que produzia disparos às
 * 04:01 BRT. Aqui não existe mais leitura de hora local do runtime.
 *
 * Assinaturas preservadas: os consumidores chamam sem argumento
 * (instante atual) — `date` é opcional apenas para testes.
 */

export const E0_WINDOW_RESUME_MIN = 70;

/** Fuso único da operação — mesma constante do motor de relacionamento. */
export const OPERATION_TIME_ZONE = "America/Sao_Paulo";

const OPEN_HOUR = 7;
const CLOSE_HOUR = 22;
const CLOSE_MINUTE = 30;
const SATURDAY_CLOSE_HOUR = 12;

/** Partes do instante já convertidas para o horário de Brasília. */
type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = domingo
};

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: OPERATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function localParts(date: Date): LocalParts {
  const parts = FORMATTER.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

const minutesOfDay = (p: LocalParts) => p.hour * 60 + p.minute;

/**
 * Instante UTC correspondente a uma data/hora local da operação.
 * O Brasil não observa horário de verão desde 2019 — o deslocamento é
 * fixo em -03:00, o mesmo pressuposto já adotado em
 * `src/lib/relationship/calendar.ts`.
 */
function fromLocal(year: number, month: number, day: number, hour: number, minute: number): Date {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return new Date(
    `${year}-${p2(month)}-${p2(day)}T${p2(hour)}:${p2(minute)}:00.000-03:00`,
  );
}

/** Avança um dia de calendário local mantendo a hora informada. */
function localDayPlus(parts: LocalParts, days: number, hour: number, minute: number): Date {
  const base = Date.UTC(parts.year, parts.month - 1, parts.day);
  const moved = new Date(base + days * 86_400_000);
  return fromLocal(
    moved.getUTCFullYear(),
    moved.getUTCMonth() + 1,
    moved.getUTCDate(),
    hour,
    minute,
  );
}

/**
 * Verdadeiro quando a janela E0 está FECHADA no instante informado
 * (horário de Brasília): madrugada/fechamento em qualquer dia, sábado a
 * partir das 12:00 e domingo o dia inteiro.
 */
export function isE0Blocked(date: Date = new Date()): boolean {
  const parts = localParts(date);
  if (parts.weekday === 0) return true; // domingo — sem envio
  const minutes = minutesOfDay(parts);
  if (parts.weekday === 6) {
    return minutes < OPEN_HOUR * 60 || minutes >= SATURDAY_CLOSE_HOUR * 60;
  }
  return minutes < OPEN_HOUR * 60 || minutes >= CLOSE_HOUR * 60 + CLOSE_MINUTE;
}

/** Nome histórico mantido para os consumidores existentes. */
export const isE0NightWindow = isE0Blocked;

/**
 * Próximo instante em que a janela E0 estará aberta a partir de `date`.
 * Se já estiver aberta, devolve o próprio instante.
 */
export function nextE0Moment(date: Date = new Date()): Date {
  let candidate = new Date(date.getTime());
  for (let i = 0; i < 10; i += 1) {
    if (!isE0Blocked(candidate)) return candidate;
    const parts = localParts(candidate);
    const minutes = minutesOfDay(parts);
    if (parts.weekday !== 0 && minutes < OPEN_HOUR * 60) {
      // Ainda é madrugada do próprio dia operacional.
      candidate = localDayPlus(parts, 0, OPEN_HOUR, 0);
      continue;
    }
    // Domingo, após o fechamento ou caso residual → próxima abertura.
    candidate = localDayPlus(parts, 1, OPEN_HOUR, 0);
  }
  return candidate;
}

/** Texto oficial do adiamento — auditado no evento `e0_adiada`. */
export function nightDeferralReason(at: Date = new Date()): string {
  const resume = localParts(nextE0Moment(at));
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `E0 adiada — fora da janela operacional (§16: Seg–Sex 07:00–22:30, Sáb 07:00–12:00, Dom sem envio; horário de Brasília). Retomada automática em ${p2(resume.day)}/${p2(resume.month)} às ${p2(resume.hour)}:${p2(resume.minute)}.`;
}
