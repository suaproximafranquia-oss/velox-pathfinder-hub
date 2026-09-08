/**
 * FOLLOW_UP DO GREENSALES → COMPROMISSO ESPELHADO — camada PURA.
 *
 * O GreenSales é a FONTE OFICIAL do agendamento. O Portal não cria nem
 * inventa horário: ele apenas interpreta o campo estruturado `follow_up`
 * e espelha o compromisso em `portal_meetings` quando o lead está em
 * AGENDAMENTOS. Este módulo não conhece banco: recebe o estado atual do
 * espelho e devolve a decisão (criar / atualizar / cancelar / nada).
 *
 * Exclusivo da Financeira /f (leads `gs_<id>` do GreenSales).
 */
import { OPERATIONAL_TIME_ZONE } from "@/lib/crm/daily-actions";

export const GREENSALES_SOURCE = "greensales";
export const AGENDAMENTOS_STAGE = "agendamentos";
export const FRIOS_STAGE = "frio";

/** Estados operacionais do acompanhamento — vocabulário fechado. */
export const FOLLOW_UP_STATES = {
  pending: "PENDENTE",
  contacted: "CONTATO_REALIZADO",
  awaitingReschedule: "AGUARDANDO_REAGENDAMENTO_GREENSALES",
  expiredNoContact: "VENCIDO_SEM_CONTATO_SEM_REAGENDAMENTO",
  closed: "ENCERRADO",
  resumeInFrios: "RETOMAR_EM_FRIOS",
  cancelledBySource: "CANCELADO_ORIGEM",
  cancelledByStage: "CANCELADO_SAIDA_AGENDAMENTOS",
} as const;

export type FollowUpState = (typeof FOLLOW_UP_STATES)[keyof typeof FOLLOW_UP_STATES];

/** Antecedência da prioridade máxima (T-5). */
export const FOLLOW_UP_FOCUS_MINUTES = 5;
/** Obrigação de verificação após o vencimento sem contato/sem reagendamento. */
export const FOLLOW_UP_REVIEW_HOURS = 24;
/**
 * Compromisso já vencido há mais tempo que isto NÃO nasce como obrigação
 * nova quando descoberto pela primeira vez (histórico da origem).
 */
export const FOLLOW_UP_STALE_HOURS = 24;

/** Identidade estável do compromisso: ambiente + origem + lead externo. */
export function followUpExternalRef(externalId: string): string {
  return `f:${GREENSALES_SOURCE}:lead:${externalId}:follow_up`;
}

/** Identificador determinístico do registro espelhado em `portal_meetings`. */
export function followUpMeetingId(externalId: string): string {
  return `gsfu_${externalId}`;
}

/** Deslocamento (minutos) de America/Sao_Paulo para um instante UTC. */
function zoneOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATIONAL_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60_000);
}

/**
 * `follow_up` chega como "YYYY-MM-DD HH:MM[:SS]" no horário da operação
 * (America/Sao_Paulo). Devolve ISO UTC ou `null` quando vazio/inválido.
 * O valor original nunca é alterado — apenas interpretado.
 */
export function parseFollowUp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (!match) {
    const direct = Date.parse(text);
    return Number.isNaN(direct) ? null : new Date(direct).toISOString();
  }
  const [, y, mo, d, h, mi, s] = match;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  // Duas passagens para estabilizar o deslocamento em torno da virada de horário.
  let offset = zoneOffsetMinutes(naive);
  offset = zoneOffsetMinutes(naive - offset * 60_000);
  const utc = naive - offset * 60_000;
  return new Date(utc).toISOString();
}

export type FollowUpMirror = {
  scheduledAt: string;
  state: FollowUpState | string | null;
  externalFollowUp: string | null;
};

export type FollowUpSyncDecision =
  | { kind: "ignore"; reason: string }
  | { kind: "create"; scheduledAt: string }
  | { kind: "update"; from: string; to: string }
  | { kind: "cancel"; reason: FollowUpState; detail: string }
  | { kind: "noop"; reason: string };

/**
 * ÚNICA regra de espelhamento. Nada de tags, texto ou tempo: só o estágio
 * estruturado e o campo `follow_up`.
 */
export function planFollowUpSync(input: {
  stageKey: string | null;
  followUp: unknown;
  existing: FollowUpMirror | null;
  nowIso: string;
}): FollowUpSyncDecision {
  const inAgendamentos = (input.stageKey ?? "").toLowerCase() === AGENDAMENTOS_STAGE;
  const scheduledAt = parseFollowUp(input.followUp);
  const existing = input.existing;
  const cancelledStates: string[] = [
    FOLLOW_UP_STATES.cancelledBySource,
    FOLLOW_UP_STATES.cancelledByStage,
  ];

  if (!inAgendamentos) {
    if (existing && existing.state === FOLLOW_UP_STATES.pending) {
      return {
        kind: "cancel",
        reason: FOLLOW_UP_STATES.cancelledByStage,
        detail: `Lead saiu de AGENDAMENTOS (estágio atual: ${input.stageKey ?? "sem estágio"}).`,
      };
    }
    return { kind: "ignore", reason: "Lead fora de AGENDAMENTOS — follow_up não é compromisso operacional." };
  }

  if (!scheduledAt) {
    if (existing && !cancelledStates.includes(String(existing.state))) {
      if (existing.state === FOLLOW_UP_STATES.pending || existing.state === FOLLOW_UP_STATES.awaitingReschedule) {
        return {
          kind: "cancel",
          reason: FOLLOW_UP_STATES.cancelledBySource,
          detail: "follow_up removido no GreenSales.",
        };
      }
    }
    return { kind: "noop", reason: "Sem follow_up válido — nenhum compromisso a espelhar." };
  }

  if (!existing) {
    const ageMs = Date.parse(input.nowIso) - Date.parse(scheduledAt);
    if (ageMs > FOLLOW_UP_STALE_HOURS * 3_600_000) {
      return {
        kind: "ignore",
        reason: `follow_up ${scheduledAt} já vencido há mais de ${FOLLOW_UP_STALE_HOURS}h na primeira leitura — histórico, não obrigação.`,
      };
    }
    return { kind: "create", scheduledAt };
  }

  const sameMoment = Date.parse(existing.scheduledAt) === Date.parse(scheduledAt);
  const sameRaw = (existing.externalFollowUp ?? "") === String(input.followUp ?? "").trim();
  if (sameMoment && sameRaw && !cancelledStates.includes(String(existing.state))) {
    return { kind: "noop", reason: "Mesmo follow_up já espelhado — nada a fazer." };
  }
  if (sameMoment && cancelledStates.includes(String(existing.state))) {
    // Voltou o MESMO horário após cancelamento: reativa o mesmo compromisso.
    return { kind: "update", from: existing.scheduledAt, to: scheduledAt };
  }
  if (sameMoment) return { kind: "noop", reason: "Mesmo horário já espelhado." };
  return { kind: "update", from: existing.scheduledAt, to: scheduledAt };
}

/** Transição estruturada AGENDAMENTOS → FRIOS — a ÚNICA que libera o R. */
export function isAgendamentosToFrios(previousStageKey: string | null, currentStageKey: string | null): boolean {
  return (
    (previousStageKey ?? "").toLowerCase() === AGENDAMENTOS_STAGE &&
    (currentStageKey ?? "").toLowerCase() === FRIOS_STAGE
  );
}

/** Momento em que a obrigação de 24h passa a ser exigida. */
export function reviewDueAt(scheduledAtIso: string): string {
  return new Date(Date.parse(scheduledAtIso) + FOLLOW_UP_REVIEW_HOURS * 3_600_000).toISOString();
}

/** Textos oficiais da Ação do Dia para o acompanhamento. */
export const FOLLOW_UP_COPY = {
  question: "Houve contato de agendamento?",
  rescheduleQuestion: "Deseja reagendar?",
  rescheduleGuidance:
    "Faça um novo agendamento no GreenSales e atualize o horário por lá. O Portal será atualizado automaticamente.",
  reviewQuestion:
    "Ontem houve um agendamento em que não houve contato e você optou por não reagendar. Deseja encerrar esse fluxo?",
  resumeGuidance:
    "Então retire esse lead de Agendamento e mova para Frios para retomarmos o relacionamento.",
} as const;
