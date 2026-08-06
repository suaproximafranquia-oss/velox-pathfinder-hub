/**
 * Camada comercial do agendamento — ponte entre a solicitação do investidor
 * (Portal) e a confirmação do executivo responsável (Workspace).
 *
 * Ao confirmar, cria automaticamente o evento no Google Calendar e o link
 * do Google Meet. A ausência da configuração Google nunca bloqueia a
 * confirmação: a reunião permanece válida e o executivo recebe um aviso
 * administrativo — o investidor jamais vê erro técnico.
 */
import {
  confirmMeetingRequest,
  listMeetings,
  updateMeetingStatus,
  type Meeting,
} from "@/lib/meetings";
import { trySyncCreate, trySyncDelete, trySyncUpdate } from "@/lib/google-calendar";
import { GOOGLE_INTEGRATION_CONFIGURED } from "@/lib/google-workspace";
import { addComment } from "@/lib/investor-comments";

export type ConfirmActor = {
  userId: string;
  userName: string;
  email?: string;
};

export type ConfirmOutcome =
  | {
      ok: true;
      meeting: Meeting;
      /** Aviso administrativo quando a integração Google não está disponível. */
      googleNotice: string | null;
    }
  | { ok: false; message: string };

const REASON_MESSAGE: Record<string, string> = {
  "not-found": "Solicitação não encontrada.",
  "not-owner": "Esta solicitação pertence a outro executivo responsável.",
  "invalid-slot": "Horário inválido para esta solicitação.",
  conflict: "Já existe uma reunião neste horário na sua agenda.",
  "already-confirmed": "Esta solicitação já foi tratada.",
};

/** Mensagem administrativa quando a configuração Google está ausente. */
export function googleConfigNotice(executiveId: string): string | null {
  void executiveId;
  if (!GOOGLE_INTEGRATION_CONFIGURED) {
    return "Integração Google ainda não configurada pelo administrador. A reunião foi registrada e o link deve ser enviado manualmente.";
  }
  return null;
}

/** Solicitações em aberto do executivo da sessão. */
export function listPendingRequests(executiveId: string): Meeting[] {
  return listMeetings({ executiveId, status: ["Solicitada"] }).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

/**
 * Confirma um dos horários preferenciais e sincroniza com o Google.
 * Nunca cria reunião para executivo diferente do responsável.
 */
export async function confirmRequest(
  meetingId: string,
  chosenIso: string,
  actor: ConfirmActor,
): Promise<ConfirmOutcome> {
  const result = confirmMeetingRequest(meetingId, chosenIso, {
    actorId: actor.userId,
    actorName: actor.userName,
  });
  if (!result.ok) {
    return { ok: false, message: REASON_MESSAGE[result.reason] ?? "Não foi possível confirmar." };
  }

  let meeting = result.meeting;
  try {
    meeting = await trySyncCreate(meeting, {
      userId: actor.userId,
      userName: actor.userName,
      userRole: "Executivo",
      email: actor.email,
    });
  } catch {
    /* a integração externa nunca bloqueia a confirmação */
  }

  const when = new Date(meeting.scheduledAt).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
  addComment({
    investorId: meeting.investorId,
    authorId: actor.userId,
    authorName: actor.userName,
    body: `Reunião confirmada para ${when}${meeting.meetUrl ? ` · ${meeting.meetUrl}` : ""}.`,
  });

  return { ok: true, meeting, googleNotice: meeting.meetUrl ? null : googleConfigNotice(actor.userId) };
}

/** Recusa/cancela uma solicitação preservando o histórico. */
export async function declineRequest(
  meeting: Meeting,
  actor: ConfirmActor,
  reason?: string,
): Promise<void> {
  updateMeetingStatus(meeting.id, "Cancelada", {
    cancelReason: reason,
    actorId: actor.userId,
    actorName: actor.userName,
  });
  await trySyncDelete(meeting, {
    userId: actor.userId,
    userName: actor.userName,
    userRole: "Executivo",
    email: actor.email,
  });
}

/** Altera o horário de uma reunião confirmada, refletindo no Google. */
export async function rescheduleConfirmed(
  meeting: Meeting,
  actor: ConfirmActor,
): Promise<Meeting> {
  return trySyncUpdate(meeting, {
    userId: actor.userId,
    userName: actor.userName,
    userRole: "Executivo",
    email: actor.email,
  });
}
