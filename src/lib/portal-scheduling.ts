/**
 * Agendamento de reuniões pelo investidor (Portal).
 *
 * A disponibilidade é derivada localmente (dias úteis, janelas comerciais)
 * e cruzada com as reuniões já existentes do executivo responsável. Quando
 * a integração com o Google Calendar estiver configurada, `trySyncCreate`
 * publica o evento automaticamente — a ausência da integração nunca impede
 * o investidor de concluir o agendamento.
 */
import { createMeeting, listMeetings, type Meeting } from "@/lib/meetings";
import { trySyncCreate } from "@/lib/google-calendar";
import { addComment } from "@/lib/investor-comments";
import { emitEvent } from "@/lib/events/bus";
import { getPortalSession, setJourneyStatus, trackSessionNavigation } from "@/lib/portal-session";
import { getResponsibleExecutive } from "@/lib/responsible-executive";
import type { ExecutiveUser } from "@/lib/executive-auth";

/** Janelas comerciais oficiais (horário local). */
const BUSINESS_HOURS = [9, 10, 11, 14, 15, 16, 17];
/** Duração padrão de uma conversa de apresentação. */
export const DEFAULT_DURATION_MIN = 45;
/** Quantidade de dias úteis ofertados a partir de amanhã. */
const HORIZON_DAYS = 10;

export type ScheduleDay = {
  /** Data no formato ISO (yyyy-mm-dd). */
  date: string;
  label: string;
  weekdayLabel: string;
  slots: ScheduleSlot[];
};

export type ScheduleSlot = {
  /** Início da reunião em ISO completo. */
  iso: string;
  label: string;
  available: boolean;
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Executivo que receberá a reunião — sempre o responsável da sessão. */
export function getSchedulingExecutive(): ExecutiveUser | null {
  return getResponsibleExecutive().executive;
}

/**
 * Constrói a agenda disponível do executivo responsável.
 * Slots já ocupados (reuniões ativas) são marcados como indisponíveis.
 */
export function listAvailability(executiveId?: string | null): ScheduleDay[] {
  const taken = new Set(
    listMeetings({ executiveId: executiveId ?? undefined })
      .filter((m) => m.status !== "Cancelada")
      .map((m) => new Date(m.scheduledAt).toISOString()),
  );

  const days: ScheduleDay[] = [];
  const cursor = startOfDay(new Date());
  let guard = 0;
  while (days.length < HORIZON_DAYS && guard < 40) {
    guard += 1;
    cursor.setDate(cursor.getDate() + 1);
    const weekday = cursor.getDay();
    if (weekday === 0 || weekday === 6) continue;

    const slots: ScheduleSlot[] = BUSINESS_HOURS.map((hour) => {
      const at = new Date(cursor);
      at.setHours(hour, 0, 0, 0);
      const iso = at.toISOString();
      return {
        iso,
        label: `${String(hour).padStart(2, "0")}:00`,
        available: !taken.has(iso),
      };
    });

    days.push({
      date: toDateKey(cursor),
      label: cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }),
      weekdayLabel: cursor.toLocaleDateString("pt-BR", { weekday: "long" }),
      slots,
    });
  }
  return days;
}

/** Reuniões futuras já agendadas pelo investidor da sessão atual. */
export function listInvestorMeetings(): Meeting[] {
  const session = getPortalSession();
  if (!session) return [];
  return listMeetings({ investorId: session.investorId })
    .filter((m) => m.status !== "Cancelada")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export type ScheduleResult =
  | { ok: true; meeting: Meeting }
  | { ok: false; reason: "no-session" | "no-executive" | "slot-taken" };

/**
 * Cria a reunião solicitada pelo investidor, registra na jornada e tenta
 * sincronizar com o Google Calendar quando disponível.
 */
export async function requestInvestorMeeting(input: {
  scheduledAt: string;
  topic?: string;
}): Promise<ScheduleResult> {
  const session = getPortalSession();
  if (!session) return { ok: false, reason: "no-session" };
  const executive = getSchedulingExecutive();
  if (!executive) return { ok: false, reason: "no-executive" };

  const conflict = listMeetings({ executiveId: executive.id }).some(
    (m) => m.status !== "Cancelada" && m.scheduledAt === input.scheduledAt,
  );
  if (conflict) return { ok: false, reason: "slot-taken" };

  let meeting = createMeeting({
    investorId: session.investorId,
    investorName: session.name,
    investorEmail: session.email,
    executiveId: executive.id,
    executiveName: executive.name,
    scheduledAt: input.scheduledAt,
    durationMin: DEFAULT_DURATION_MIN,
  });

  try {
    meeting = await trySyncCreate(meeting, {
      userId: executive.id,
      userName: executive.name,
      userRole: "Executivo",
      email: executive.email,
    });
  } catch {
    /* a integração externa nunca bloqueia o agendamento */
  }

  const when = new Date(input.scheduledAt).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  emitEvent({
    type: "meeting.created",
    investorId: session.investorId,
    actorId: executive.id,
    payload: {
      meetingId: meeting.id,
      scheduledAt: input.scheduledAt,
      topic: input.topic ?? null,
      source: "portal",
    },
  });

  addComment({
    investorId: session.investorId,
    authorId: "ai_corporate",
    authorName: "IA Corporativa",
    body: `Investidor solicitou uma conversa para ${when}${
      input.topic ? ` — assunto: ${input.topic}` : ""
    }.`,
  });

  trackSessionNavigation("agenda", `Reunião solicitada para ${when}`);
  setJourneyStatus("contato");

  return { ok: true, meeting };
}