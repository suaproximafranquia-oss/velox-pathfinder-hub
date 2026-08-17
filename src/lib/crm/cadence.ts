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
export type CadenceChannel = "call" | "message";

/**
 * Resultado real de uma tentativa de ligação (COMANDO 2A §12).
 * Só existem dois desfechos: o investidor atendeu ou não atendeu.
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
   * realizada. O primeiro elemento é sempre 0: a L1 vence na própria
   * data da entrada comercial. L1 → +2 → L2 → +1 → L3 → +3 → L4.
   */
  offsets: number[];
};

export const CADENCE_CONFIG: Record<CadenceChannel, CadenceConfig> = {
  call: { enabled: true, offsets: [0, 2, 1, 3] },
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
 * Data de ativação da cadência. Leads históricos (entrada comercial
 * anterior a esta data) NÃO recebem fila retroativa; a regra vale para
 * novas entradas comerciais — inclusive de leads antigos que voltam.
 */
export const CADENCE_ACTIVATION_DATE = "2026-08-15";

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
  ingestedAt?: string | null;
}): string | null {
  const source = lead.lastEntryAt ?? lead.externalCreatedAt ?? lead.ingestedAt ?? null;
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
): { step: number; dueDate: string } | null {
  const config = CADENCE_CONFIG.call;
  if (!config.enabled) return null;
  const history = [...attempts].sort((a, b) => a.step - b.step);
  if (history.some((a) => a.outcome === "SIM")) return null;

  const done = history.length;
  if (done >= config.offsets.length) return null;

  // §7 — duas recusas consecutivas em L2 e L3 encerram o ciclo.
  if (done >= 3) {
    const l2 = history.find((a) => a.step === 2);
    const l3 = history.find((a) => a.step === 3);
    if (l2?.outcome === "NAO" && l3?.outcome === "NAO") return null;
  }

  const offset = config.offsets[done] ?? 0;
  const anchor = done === 0 ? baseDate : (history[done - 1]?.date ?? baseDate);
  const dueDate = done === 0 ? nextBusinessDay(anchor) : addBusinessDays(anchor, offset);
  return { step: done + 1, dueDate };
}
