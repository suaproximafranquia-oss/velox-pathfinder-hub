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

export type Meeting = {
  id: string;
  investorId: string;
  investorName: string;
  executiveId: string;
  executiveName: string;
  scheduledAt: string; // ISO
  status: MeetingStatus;
  meetUrl?: string;
  notes: MeetingNote[];
  cancelReason?: string;
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
  executiveId: string;
  executiveName: string;
  scheduledAt: string;
  meetUrl?: string;
}): Meeting {
  const now = new Date().toISOString();
  const meeting: Meeting = {
    id: newId("mt"),
    ...input,
    status: "Agendada",
    notes: [],
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

export const MEETING_STATUS_TONE: Record<MeetingStatus, string> = {
  Agendada: "var(--gold)",
  Confirmada: "#4A7C59",
  Reagendada: "#B08D57",
  "Em andamento": "#3B7EA1",
  Concluída: "#2C5282",
  Cancelada: "#8B5A3C",
};