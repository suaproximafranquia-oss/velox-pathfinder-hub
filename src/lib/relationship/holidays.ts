/**
 * CALENDÁRIO OFICIAL DE NÃO-ENVIO — FERIADOS NACIONAIS + ESTADUAIS SP.
 *
 * Decisão fechada no Refino Final: feriado é dia SEM envio automático
 * e NÃO conta como dia útil no cálculo de prazos (D+n, checkpoint,
 * finalização). A regra é pura: nada de banco, nada de rede.
 *
 * Fonte das datas móveis: Páscoa (algoritmo de Meeus/Jones/Butcher) →
 * Carnaval (-47d), Sexta-feira Santa (-2d) e Corpus Christi (+60d).
 *
 * MANUTENÇÃO PELO ADMINISTRADOR: datas extras (pontos facultativos,
 * recesso da operação) entram por `addNonBusinessDays` sem migração e
 * sem alterar o código desta lista.
 */

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const shift = (base: Date, days: number) =>
  new Date(base.getTime() + days * 86_400_000);

/** Domingo de Páscoa do ano informado (em UTC, sem hora). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Feriados NACIONAIS + ESTADUAIS DE SÃO PAULO de um ano, em ISO local.
 * Consciência de fuso não é necessária: a data é o próprio dia civil.
 */
export function brazilSpHolidays(year: number): string[] {
  const easter = easterSunday(year);
  const fixed = [
    `${year}-01-01`, // Confraternização Universal
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalho
    `${year}-07-09`, // Revolução Constitucionalista (SP)
    `${year}-09-07`, // Independência
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Consciência Negra (nacional desde 2024)
    `${year}-12-25`, // Natal
  ];
  const movable = [
    iso(shift(easter, -48)), // Segunda de Carnaval
    iso(shift(easter, -47)), // Carnaval
    iso(shift(easter, -2)), // Sexta-feira Santa
    iso(shift(easter, 60)), // Corpus Christi
  ];
  return [...fixed, ...movable].sort();
}

/** Janela coberta pelo calendário: ano anterior, atual e próximo. */
export function defaultNonBusinessDays(reference: Date = new Date()): string[] {
  const year = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    }).format(reference),
  );
  return [year - 1, year, year + 1].flatMap((y) => brazilSpHolidays(y)).sort();
}
