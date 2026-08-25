/**
 * Central de Reuniões — Parte 1/3.
 *
 * Modelo mínimo, persistido em localStorage, preparado para futura
 * sincronização com backend e integração opcional com Google Meet.
 * A ausência da integração externa nunca impede a criação ou
 * conclusão de uma reunião.
 */
import { emitEvent } from "@/lib/events/bus";
import { logAudit } from "@/lib/audit-log";

import { notifySync, runSyncMuted } from "@/lib/sync-bus";

export type MeetingStatus =
  | "Solicitada"
  | "Agendada"
  | "Confirmada"
  | "Reagendada"
  | "Em andamento"
  | "Concluída"
  | "Cancelada";

export type MeetingNote = {
  id: string;
  at: string;
  authorId: string;
  authorName: string;
  text: string;
};

export type GoogleSyncState = "none" | "synced" | "pending" | "failed";

import type { MeetingProviderId, MeetingProviderStatus } from "@/lib/meeting-providers";

export type Meeting = {
  id: string;
  investorId: string;
  investorName: string;
  investorEmail?: string;
  executiveId: string;
  executiveName: string;
  scheduledAt: string; // ISO
  durationMin?: number;
  status: MeetingStatus;
  meetUrl?: string;
  notes: MeetingNote[];
  cancelReason?: string;
  /**
   * Solicitações do Portal: horários preferenciais informados pelo investidor.
   * O executivo confirma um deles — nunca cria reunião para outro executivo.
   */
  requestedSlots?: string[];
  /** Assunto/tema declarado pelo investidor na solicitação. */
  topic?: string;
  /** Origem do registro — preparado para o CRM Inteligente. */
  origin?: "portal" | "executivo";
  googleEventId?: string;
  googleSync?: GoogleSyncState;
  googleSyncError?: string;
  googleSyncedAt?: string;
  // Meeting Providers (Bloco 1B) — provedor de videoconferência intercambiável.
  meetingProvider?: MeetingProviderId;
  meetingProviderStatus?: MeetingProviderStatus;
  meetingProviderMeetingId?: string;
  meetingProviderUrl?: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "velox:meetings:v1";

function safeRead(): Meeting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Meeting[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: Meeting[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
  // Reunião criada/alterada aparece na hora para Executivo, Gestora e
  // Administrador, em qualquer módulo aberto.
  notifySync("meetings");
}

function persistMeeting(meeting: Meeting) {
  if (typeof window === "undefined") return;
  void import("@/lib/meetings.functions")
    .then(({ upsertMeetingOnServer }) => upsertMeetingOnServer({ data: meeting }))
    .catch(() => undefined);
}

export async function hydrateMeetingsFromServer(): Promise<number> {
  const { listMeetingsFromServer } = await import("@/lib/meetings.functions");
  const rows = await listMeetingsFromServer();
  const meetings: Meeting[] = rows.map((row) => ({
    id: row.id,
    investorId: row.investor_id,
    investorName: row.investor_name,
    investorEmail: row.investor_email ?? undefined,
    executiveId: row.executive_id,
    executiveName: row.executive_name,
    scheduledAt: row.scheduled_at,
    durationMin: row.duration_min,
    status: row.status as MeetingStatus,
    meetUrl: row.meet_url ?? undefined,
    notes: (row.notes as MeetingNote[]) ?? [],
    cancelReason: row.cancel_reason ?? undefined,
    requestedSlots: (row.requested_slots as string[]) ?? [],
    topic: row.topic ?? undefined,
    origin: row.origin as "portal" | "executivo",
    googleEventId: row.google_event_id ?? undefined,
    googleSync: row.google_sync as GoogleSyncState,
    googleSyncError: row.google_sync_error ?? undefined,
    googleSyncedAt: row.google_synced_at ?? undefined,
    meetingProvider: row.meeting_provider as MeetingProviderId | undefined,
    meetingProviderStatus: row.meeting_provider_status as MeetingProviderStatus | undefined,
    meetingProviderMeetingId: row.meeting_provider_meeting_id ?? undefined,
    meetingProviderUrl: row.meeting_provider_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  // Espelho do servidor: grava sem reavisar o barramento (estabilidade).
  runSyncMuted(() => safeWrite(meetings));
  return meetings.length;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function listMeetings(filter?: {
  executiveId?: string;
  investorId?: string;
  status?: MeetingStatus[];
}): Meeting[] {
  return safeRead().filter((m) => {
    if (filter?.executiveId && m.executiveId !== filter.executiveId) return false;
    if (filter?.investorId && m.investorId !== filter.investorId) return false;
    if (filter?.status && !filter.status.includes(m.status)) return false;
    return true;
  });
}

export function createMeeting(input: {
  investorId: string;
  investorName: string;
  investorEmail?: string;
  executiveId: string;
  executiveName: string;
  scheduledAt: string;
  durationMin?: number;
  meetUrl?: string;
  meetingProvider?: import("@/lib/meeting-providers").MeetingProviderId;
  meetingProviderStatus?: import("@/lib/meeting-providers").MeetingProviderStatus;
  meetingProviderUrl?: string;
  status?: MeetingStatus;
  requestedSlots?: string[];
  topic?: string;
  origin?: "portal" | "executivo";
}): Meeting {
  const now = new Date().toISOString();
  const meeting: Meeting = {
    id: newId("mt"),
    ...input,
    durationMin: input.durationMin ?? 60,
    status: input.status ?? "Agendada",
    origin: input.origin ?? "executivo",
    notes: [],
    googleSync: "none",
    createdAt: now,
    updatedAt: now,
  };
  const all = safeRead();
  all.push(meeting);
  safeWrite(all);
  persistMeeting(meeting);
  emitEvent({
    type: meeting.status === "Solicitada" ? "meeting.requested" : "meeting.created",
    actorId: input.executiveId,
    investorId: input.investorId,
    payload: {
      meetingId: meeting.id,
      scheduledAt: input.scheduledAt,
      requestedSlots: meeting.requestedSlots ?? null,
      origin: meeting.origin,
    },
  });
  logAudit({
    actorId: input.executiveId,
    actorName: input.executiveName,
    actorRole: "Executivo",
    module: "investidores",
    action: meeting.status === "Solicitada" ? "Reunião solicitada pelo investidor" : "Reunião agendada",
    target: input.investorName,
    severity: "info",
  });
  return meeting;
}

/**
 * Confirma uma solicitação do Portal em um dos horários preferenciais.
 * Valida horário, conflito de agenda e a titularidade do executivo.
 */
export function confirmMeetingRequest(
  id: string,
  chosenIso: string,
  actor: { actorId: string; actorName: string },
):
  | { ok: true; meeting: Meeting }
  | { ok: false; reason: "not-found" | "not-owner" | "invalid-slot" | "conflict" | "already-confirmed" } {
  const all = safeRead();
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return { ok: false, reason: "not-found" };
  const prev = all[idx];
  if (prev.executiveId !== actor.actorId) return { ok: false, reason: "not-owner" };
  if (prev.status !== "Solicitada") return { ok: false, reason: "already-confirmed" };
  const options = prev.requestedSlots?.length ? prev.requestedSlots : [prev.scheduledAt];
  if (!options.includes(chosenIso)) return { ok: false, reason: "invalid-slot" };
  if (Number.isNaN(Date.parse(chosenIso))) return { ok: false, reason: "invalid-slot" };

  const conflict = all.some(
    (m) =>
      m.id !== id &&
      m.executiveId === prev.executiveId &&
      m.status !== "Cancelada" &&
      m.status !== "Solicitada" &&
      m.scheduledAt === chosenIso,
  );
  if (conflict) return { ok: false, reason: "conflict" };

  const next: Meeting = {
    ...prev,
    scheduledAt: chosenIso,
    status: "Confirmada",
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  safeWrite(all);
  persistMeeting(next);
  emitEvent({
    type: "meeting.confirmed",
    actorId: actor.actorId,
    investorId: next.investorId,
    payload: { meetingId: next.id, scheduledAt: next.scheduledAt },
  });
  logAudit({
    actorId: actor.actorId,
    actorName: actor.actorName,
    actorRole: "Executivo",
    module: "investidores",
    action: "Reunião confirmada",
    target: next.investorName,
    details: `Horário confirmado: ${new Date(chosenIso).toLocaleString("pt-BR")}.`,
    severity: "success",
  });
  return { ok: true, meeting: next };
}

/** Aplica dados de sincronização Google (evento/meet) numa reunião. */
export function applyGoogleSyncPatch(
  id: string,
  patch: {
    googleEventId?: string | null;
    meetUrl?: string | null;
    googleSync?: GoogleSyncState;
    googleSyncError?: string | null;
    googleSyncedAt?: string | null;
    /** Novo horário quando a alteração veio do próprio Google Agenda. */
    scheduledAt?: string;
  },
): Meeting | null {
  const all = safeRead();
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const prev = all[idx];
  const next: Meeting = {
    ...prev,
    scheduledAt: patch.scheduledAt ?? prev.scheduledAt,
    googleEventId:
      patch.googleEventId === null ? undefined : patch.googleEventId ?? prev.googleEventId,
    meetUrl:
      patch.meetUrl === null ? undefined : patch.meetUrl ?? prev.meetUrl,
    googleSync: patch.googleSync ?? prev.googleSync,
    googleSyncError:
      patch.googleSyncError === null ? undefined : patch.googleSyncError ?? prev.googleSyncError,
    googleSyncedAt:
      patch.googleSyncedAt === null ? undefined : patch.googleSyncedAt ?? prev.googleSyncedAt,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  safeWrite(all);
  persistMeeting(next);
  return next;
}

export function updateMeetingStatus(
  id: string,
  status: MeetingStatus,
  extra?: { cancelReason?: string; scheduledAt?: string; actorId?: string; actorName?: string },
): Meeting | null {
  const all = safeRead();
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const prev = all[idx];
  const next: Meeting = {
    ...prev,
    status,
    updatedAt: new Date().toISOString(),
    scheduledAt: extra?.scheduledAt ?? prev.scheduledAt,
    cancelReason: status === "Cancelada" ? extra?.cancelReason ?? prev.cancelReason : prev.cancelReason,
  };
  all[idx] = next;
  safeWrite(all);
  persistMeeting(next);
  const type =
    status === "Concluída" ? "meeting.completed" :
    status === "Cancelada" ? "meeting.cancelled" :
    status === "Reagendada" ? "meeting.rescheduled" :
    null;
  if (type) {
    emitEvent({
      type,
      actorId: extra?.actorId ?? next.executiveId,
      investorId: next.investorId,
      payload: { meetingId: next.id, status },
    });
  }
  return next;
}

export function updateMeeting(
  id: string,
  patch: {
    scheduledAt?: string;
    meetUrl?: string;
    meetingProvider?: import("@/lib/meeting-providers").MeetingProviderId;
    meetingProviderStatus?: import("@/lib/meeting-providers").MeetingProviderStatus;
    meetingProviderUrl?: string;
  },
  actor?: { actorId: string; actorName: string },
): Meeting | null {
  const all = safeRead();
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const prev = all[idx];
  const next: Meeting = {
    ...prev,
    scheduledAt: patch.scheduledAt ?? prev.scheduledAt,
    meetUrl: patch.meetUrl !== undefined ? patch.meetUrl || undefined : prev.meetUrl,
    meetingProvider: patch.meetingProvider ?? prev.meetingProvider,
    meetingProviderStatus: patch.meetingProviderStatus ?? prev.meetingProviderStatus,
    meetingProviderUrl:
      patch.meetingProviderUrl !== undefined
        ? patch.meetingProviderUrl || undefined
        : prev.meetingProviderUrl,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  safeWrite(all);
  persistMeeting(all[idx]);
  emitEvent({
    type: "meeting.rescheduled",
    actorId: actor?.actorId ?? next.executiveId,
    investorId: next.investorId,
    payload: { meetingId: next.id, scheduledAt: next.scheduledAt },
  });
  logAudit({
    actorId: actor?.actorId ?? next.executiveId,
    actorName: actor?.actorName ?? next.executiveName,
    actorRole: "Executivo",
    module: "investidores",
    action: "Reunião editada",
    target: next.investorName,
    severity: "info",
  });
  return next;
}

export function addMeetingNote(
  id: string,
  note: { authorId: string; authorName: string; text: string },
): Meeting | null {
  const all = safeRead();
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const entry: MeetingNote = {
    id: newId("nt"),
    at: new Date().toISOString(),
    ...note,
  };
  all[idx] = {
    ...all[idx],
    notes: [...all[idx].notes, entry],
    updatedAt: entry.at,
  };
  safeWrite(all);
  return all[idx];
}

export function deleteMeeting(
  id: string,
  actor?: { actorId: string; actorName: string },
): boolean {
  const all = safeRead();
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  const [removed] = all.splice(idx, 1);
  safeWrite(all);
  void import("@/lib/meetings.functions")
    .then(({ deleteMeetingOnServer }) => deleteMeetingOnServer({ data: { id: removed.id } }))
    .catch(() => undefined);
  emitEvent({
    type: "meeting.deleted",
    actorId: actor?.actorId ?? removed.executiveId,
    investorId: removed.investorId,
    payload: { meetingId: removed.id, scheduledAt: removed.scheduledAt },
  });
  logAudit({
    actorId: actor?.actorId ?? removed.executiveId,
    actorName: actor?.actorName ?? removed.executiveName,
    actorRole: "Executivo",
    module: "investidores",
    action: "Reunião excluída",
    target: removed.investorName,
    details: `Reunião de ${new Date(removed.scheduledAt).toLocaleString("pt-BR")} removida permanentemente.`,
    severity: "warning",
  });
  return true;
}

export const MEETING_STATUS_TONE: Record<MeetingStatus, string> = {
  Solicitada: "#B08D57",
  Agendada: "var(--gold)",
  Confirmada: "#4A7C59",
  Reagendada: "#B08D57",
  "Em andamento": "#3B7EA1",
  Concluída: "#2C5282",
  Cancelada: "#8B5A3C",
};