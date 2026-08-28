/**
 * Motor de cadência comercial do Portal dos Leads.
 *
 * Camada operacional sobre os leads sincronizados — nunca um segundo CRM.
 * O GreenSales continua sendo a fonte da verdade da etapa; aqui só
 * calculamos qual atividade é devida hoje para cada lead.
 *
 * Toda a regra comercial vive neste arquivo (intervalos, tentativas,
 * elegibilidade, dias úteis, data de ativação). A interface não decide
 * nada — apenas apresenta o que este motor calcula.
 */
import { preferNonCollidingCallDate } from "./call-planning";

export type CadenceChannel = "call" | "message";

/**
 * Resultado real de uma tentativa de ligação (COMANDO 2A §12,
 * COMANDO 3D §14). "SIM" = a ligação foi realizada; "NAO" = não houve
 * contato. Ligar não encerra a fila: quem encerra é a sequência de
 * desfechos definida no §15.
 */
export type CallOutcome = "SIM" | "NAO";

export type CadenceAttempt = {
  step: number;
  /** Data real (YYYY-MM-DD) em que a tentativa foi executada. */
  date: string;
  outcome: CallOutcome;
};

export type CadenceConfig = {
  enabled: boolean;
  /**
   * Intervalos em DIAS ÚTEIS a partir da ligação anterior efetivamente
   * realizada (a primeira, a partir da entrada na etapa elegível).
   */
  offsets: number[];
};

/**
 * COMANDO 3D §12, §13 — a L1 é MANUAL, feita pelo Executivo enquanto o
 * lead ainda está em NOVOS. A fila automática começa em L2, quando a
 * origem move o lead para ZERO CONTATO ou FRIO:
 *   L2 = +2 dias úteis, L3 = +1 dia útil, L4 = +3 dias úteis.
 */
export const FIRST_AUTOMATED_CALL_STEP = 2;

/**
 * QUARTA TENTATIVA (nova regra).
 *
 * Depois da última tentativa da sequência de dias úteis existe mais uma
 * ligação, aproximadamente 7 dias corridos após a tentativa anterior.
 * Caindo em sábado/domingo/feriado, ela vai para o próximo dia útil.
 * Esta tentativa NÃO altera a cadência de mensagens.
 */
export const FOURTH_ATTEMPT_CALENDAR_DAYS = 7;

export const CADENCE_CONFIG: Record<CadenceChannel, CadenceConfig> = {
  /**
   * DIA OPERACIONAL, NUNCA "+24 HORAS".
   *
   * A primeira tentativa automática pertence ao PRÓXIMO DIA OPERACIONAL
   * após a movimentação para ZERO CONTATO / FRIO — não importa se o lead
   * foi movido às 08:00 ou às 18:00: no dia seguinte ele já pertence à
   * fila da manhã. Depois: L3 = +1 dia útil, L4 = +3 dias úteis e a
   * quarta tentativa automática (L5) ≈ 7 dias corridos.
   */
  call: { enabled: true, offsets: [1, 1, 3, FOURTH_ATTEMPT_CALENDAR_DAYS] },
  /**
   * LEGADO — a cadência de MENSAGENS pertence agora exclusivamente ao
   * Motor de Relacionamento (`src/lib/relationship`). Este canal
   * permanece desligado permanentemente para que nunca existam dois
   * motores disparando a mesma finalidade (COMANDO 2A §109). O histórico
   * já gravado continua intacto; só a execução futura mudou de dono.
   */
  message: { enabled: false, offsets: [0, 1, 2, 1, 7] },
};

/** Quantidade de tentativas do canal. */
export function totalSteps(channel: CadenceChannel): number {
  return CADENCE_CONFIG[channel].offsets.length;
}

/**
 * Etapas da origem em que o lead ainda precisa de tentativa de contato
 * (COMANDO 2A §2). "NOVOS" foi removido: enquanto o lead está em NOVOS
 * ele pertence ao primeiro contato por mensagem; a fila de ligações só
 * começa quando a origem o move para ZERO CONTATO ou FRIO.
 */
export const ELIGIBLE_STAGE_KEYS = ["zero_contato", "frio"] as const;

export function isEligibleStage(stageKey: string | null): boolean {
  return Boolean(stageKey && (ELIGIBLE_STAGE_KEYS as readonly string[]).includes(stageKey));
}

/**
 * A data de ativação da cadência NÃO é fixa no código: é configuração
 * operacional (`crm_automation_settings.cadence_activation_date`), lida
 * pelo servidor. Enquanto não estiver definida, nenhuma fila é gerada e
 * nenhum lead histórico recebe etapa retroativa.
 */

/** Feriados (YYYY-MM-DD) tratados como dias não úteis. Evolutivo. */
export const NON_BUSINESS_DAYS: string[] = [];

const TIME_ZONE = "America/Sao_Paulo";

/** Data comercial (YYYY-MM-DD) no fuso da operação. */
export function commercialDate(value: string | Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

export function isBusinessDay(isoDate: string): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !NON_BUSINESS_DAYS.includes(isoDate);
}

/** Empurra sábados, domingos e feriados para o próximo dia útil. */
export function nextBusinessDay(isoDate: string): string {
  let date = isoDate;
  for (let i = 0; i < 30 && !isBusinessDay(date); i += 1) date = addDays(date, 1);
  return date;
}

/** Soma dias úteis; 0 apenas normaliza para o próximo dia útil. */
export function addBusinessDays(isoDate: string, days: number): string {
  let date = nextBusinessDay(isoDate);
  for (let i = 0; i < days; i += 1) date = nextBusinessDay(addDays(date, 1));
  return date;
}

/**
 * Data de entrada comercial do ciclo atual. Nunca usar `ingestedAt` ou
 * `lastSyncedAt` como referência — eles são técnicos. Uma nova entrada
 * (`lastEntryAt`) abre um novo ciclo sobre o mesmo lead.
 */
export function cadenceCycleDate(lead: {
  lastEntryAt?: string | null;
  externalCreatedAt: string | null;
  /** Aceito por compatibilidade; NUNCA usado como data de entrada. */
  ingestedAt?: string | null;
}): string | null {
  const source = lead.lastEntryAt ?? lead.externalCreatedAt ?? null;
  if (!source) return null;
  return commercialDate(source) || null;
}

/** Compatibilidade com o cálculo anterior. */
export const cadenceBaseDate = cadenceCycleDate;

/**
 * Próxima tentativa de um ciclo, calculada SEMPRE a partir da última
 * ligação efetivamente realizada — nunca da data originalmente prevista.
 * `completedDates` são as datas reais (YYYY-MM-DD) das conclusões, em ordem.
 */
export function nextCadenceStep(
  channel: CadenceChannel,
  cycleDate: string,
  completedDates: string[],
): { step: number; dueDate: string } | null {
  const config = CADENCE_CONFIG[channel];
  if (!config.enabled) return null;
  const done = completedDates.length;
  if (done >= config.offsets.length) return null;
  const offset = config.offsets[done] ?? 0;
  const anchor = done === 0 ? cycleDate : (completedDates[done - 1] ?? cycleDate);
  const dueDate = done === 0 ? nextBusinessDay(anchor) : addBusinessDays(anchor, offset);
  return { step: done + 1, dueDate };
}

/**
 * Sequência de ligações do ciclo (COMANDO 2A §3, §7).
 *
 * `baseDate` é a data em que o lead ENTROU na etapa elegível (transição
 * para ZERO CONTATO / FRIO) — nunca a data de cadastro. As tentativas
 * seguintes partem sempre da ligação realmente executada.
 *
 * Regras de encerramento:
 *   • qualquer tentativa com resultado SIM encerra a fila do ciclo — o
 *     contato aconteceu e a condução passa a ser do Executivo;
 *   • L2 = NÃO e L3 = NÃO encerram o ciclo sem gerar L4.
 */
export function nextCallAttempt(
  baseDate: string,
  attempts: CadenceAttempt[],
  /**
   * Datas de mensagens já previstas para este lead. Uso exclusivo de
   * PREFERÊNCIA de calendário: nunca altera a cadência de mensagens e
   * nunca cria dependência entre os motores.
   */
  plannedMessageDates: readonly string[] = [],
): { step: number; dueDate: string } | null {
  const config = CADENCE_CONFIG.call;
  if (!config.enabled) return null;
  const history = [...attempts].sort((a, b) => a.step - b.step);
  const done = history.length;
  if (done >= config.offsets.length) return null;

  // §15 — L2 sem contato e L3 sem contato encerram o ciclo sem gerar L4.
  const l2 = history.find((a) => a.step === 2);
  const l3 = history.find((a) => a.step === 3);
  if (l2?.outcome === "NAO" && l3?.outcome === "NAO") return null;

  const offset = config.offsets[done] ?? 0;
  const anchor = done === 0 ? baseDate : (history[done - 1]?.date ?? baseDate);
  // A última tentativa conta DIAS CORRIDOS (≈7) e depois é empurrada
  // para o próximo dia útil; as demais seguem em dias úteis.
  const isFourthAttempt = done === config.offsets.length - 1;
  const dueDate = isFourthAttempt
    ? nextBusinessDay(addDays(anchor, FOURTH_ATTEMPT_CALENDAR_DAYS))
    : addBusinessDays(anchor, offset);
  const preference = preferNonCollidingCallDate(dueDate, plannedMessageDates);
  return { step: done + FIRST_AUTOMATED_CALL_STEP, dueDate: preference.date };
}

/**
 * IDENTIDADE TEXTUAL DA ETAPA (fundação).
 *
 * A etapa da jornada NÃO é "o dia N": o dia é apenas onde ela caiu no
 * calendário. A chave é textual e estável — `L1..L4` para ligações,
 * `M1..Mn` para mensagens desta fila — e convive com as chaves do Motor
 * de Relacionamento (`E0`, `E1`, `E6`, `R0`…), que já são textuais.
 *
 * Nenhuma regra de agendamento depende desta função: ela apenas dá nome
 * ao que antes era só um número.
 */
export function stepKey(channel: CadenceChannel, step: number): string {
  const prefix = channel === "ligacao" ? "L" : "M";
  return `${prefix}${step}`;
}
