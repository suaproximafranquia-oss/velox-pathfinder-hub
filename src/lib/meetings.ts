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

export type MeetingStatus =
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
}): Meeting {
  const now = new Date().toISOString();
  const meeting: Meeting = {
    id: newId("mt"),
    ...input,
    durationMin: input.durationMin ?? 60,
    status: "Agendada",
    notes: [],
    googleSync: "none",
    createdAt: now,
    updatedAt: now,
  };
  const all = safeRead();
  all.push(meeting);
  safeWrite(all);
  emitEvent({
    type: "meeting.created",
    actorId: input.executiveId,
    investorId: input.investorId,
    payload: { meetingId: meeting.id, scheduledAt: input.scheduledAt },
  });
  logAudit({
    actorId: input.executiveId,
    actorName: input.executiveName,
    actorRole: "Executivo",
    module: "investidores",
    action: "Reunião agendada",
    target: input.investorName,
    severity: "info",
  });
  return meeting;
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
  },
): Meeting | null {
  const all = safeRead();
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const prev = all[idx];
  const next: Meeting = {
    ...prev,
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
  patch: { scheduledAt?: string; meetUrl?: string },
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
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  safeWrite(all);
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
  Agendada: "var(--gold)",
  Confirmada: "#4A7C59",
  Reagendada: "#B08D57",
  "Em andamento": "#3B7EA1",
  Concluída: "#2C5282",
  Cancelada: "#8B5A3C",
};