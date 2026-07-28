/**
 * Google Calendar / Meet — Integração (Etapa 2 · Bloco 1A · Parte 2/2).
 *
 * Consome a infraestrutura de autenticação existente (`google-workspace.ts`),
 * o modelo de reuniões (`meetings.ts`), o barramento de eventos e a auditoria.
 *
 * Enquanto a credencial OAuth real do App User Connector não estiver
 * provisionada, as chamadas para o Google são simuladas por um "espelho"
 * local persistido em `velox:google-calendar:v1`, preservando ids de
 * evento, links do Meet e detecção de conflitos. A troca pela chamada
 * real acontece sem alterar a superfície pública deste módulo.
 */
import { emitEvent } from "@/lib/events/bus";
import { logAudit } from "@/lib/audit-log";
import {
  ensureFreshToken,
  getGoogleStore,
} from "@/lib/google-workspace";
import {
  applyGoogleSyncPatch,
  listMeetings,
  type Meeting,
} from "@/lib/meetings";

export type GoogleCalendarEvent = {
  id: string;
  ownerId: string;
  summary: string;
  description: string;
  start: string; // ISO
  end: string; // ISO
  timeZone: string;
  attendees: string[];
  meetUrl: string;
  meetingId: string;
  updatedAt: string;
  cancelled?: boolean;
};

const STORAGE_KEY = "velox:google-calendar:v1";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

type Actor = { userId: string; userName: string; userRole: string; email?: string };

function safeRead(): GoogleCalendarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoogleCalendarEvent[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: GoogleCalendarEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

function randomMeetCode(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

function newEventId(): string {
  return `gce_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function endOf(meeting: Meeting): string {
  const start = new Date(meeting.scheduledAt).getTime();
  const min = meeting.durationMin ?? 60;
  return new Date(start + min * 60_000).toISOString();
}

function summaryOf(meeting: Meeting): string {
  return `Reunião - ${meeting.investorName}`;
}

function descriptionOf(meeting: Meeting): string {
  const parts = [
    `Investidor: ${meeting.investorName}`,
    `Executivo responsável: ${meeting.executiveName}`,
  ];
  const lastNote = meeting.notes[meeting.notes.length - 1];
  if (lastNote) parts.push(`Observações: ${lastNote.text}`);
  parts.push(`ID interno: ${meeting.id}`);
  return parts.join("\n");
}

function attendeesOf(meeting: Meeting, executiveEmail?: string): string[] {
  const out = new Set<string>();
  if (executiveEmail) out.add(executiveEmail);
  if (meeting.investorEmail) out.add(meeting.investorEmail);
  return [...out];
}

/** Conflitos: eventos do executivo com sobreposição temporal. */
export function checkConflicts(
  ownerId: string,
  startIso: string,
  endIso: string,
  excludeEventId?: string,
): GoogleCalendarEvent[] {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return safeRead().filter((ev) => {
    if (ev.ownerId !== ownerId) return false;
    if (ev.cancelled) return false;
    if (excludeEventId && ev.id === excludeEventId) return false;
    const s = new Date(ev.start).getTime();
    const e = new Date(ev.end).getTime();
    return s < end && e > start;
  });
}

async function requireToken(actor: Actor): Promise<string> {
  const token = await ensureFreshToken(actor.userId);
  if (!token) throw new Error("Conta Google desconectada.");
  return token;
}

/** Cria um evento no Calendar (com Meet) e vincula ao registro interno. */
export async function syncCreate(meeting: Meeting, actor: Actor): Promise<Meeting> {
  await requireToken(actor);
  const store = getGoogleStore(actor.userId);
  const executiveEmail = actor.email ?? store.account?.email;
  const start = meeting.scheduledAt;
  const end = endOf(meeting);
  const event: GoogleCalendarEvent = {
    id: newEventId(),
    ownerId: actor.userId,
    summary: summaryOf(meeting),
    description: descriptionOf(meeting),
    start,
    end,
    timeZone: DEFAULT_TIMEZONE,
    attendees: attendeesOf(meeting, executiveEmail),
    meetUrl: `https://meet.google.com/${randomMeetCode()}`,
    meetingId: meeting.id,
    updatedAt: new Date().toISOString(),
  };
  const all = safeRead();
  all.push(event);
  safeWrite(all);
  const patched = applyGoogleSyncPatch(meeting.id, {
    googleEventId: event.id,
    meetUrl: event.meetUrl,
    googleSync: "synced",
    googleSyncError: null,
    googleSyncedAt: event.updatedAt,
  }) ?? meeting;
  emitEvent({
    type: "meeting.google.created",
    actorId: actor.userId,
    investorId: meeting.investorId,
    payload: { meetingId: meeting.id, googleEventId: event.id, meetUrl: event.meetUrl },
  });
  logAudit({
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "investidores",
    action: "Google Calendar · evento criado",
    target: meeting.investorName,
    details: `Evento ${event.id} · Meet ${event.meetUrl} · ID interno ${meeting.id}`,
    severity: "success",
  });
  return patched;
}

/** Atualiza data/hora/descrição/participantes do evento existente. */
export async function syncUpdate(meeting: Meeting, actor: Actor): Promise<Meeting> {
  if (!meeting.googleEventId) return syncCreate(meeting, actor);
  await requireToken(actor);
  const store = getGoogleStore(actor.userId);
  const executiveEmail = actor.email ?? store.account?.email;
  const all = safeRead();
  const idx = all.findIndex((e) => e.id === meeting.googleEventId);
  if (idx < 0) return syncCreate(meeting, actor);
  const prev = all[idx];
  const next: GoogleCalendarEvent = {
    ...prev,
    summary: summaryOf(meeting),
    description: descriptionOf(meeting),
    start: meeting.scheduledAt,
    end: endOf(meeting),
    attendees: attendeesOf(meeting, executiveEmail),
    cancelled: false,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  safeWrite(all);
  const patched = applyGoogleSyncPatch(meeting.id, {
    googleSync: "synced",
    googleSyncError: null,
    googleSyncedAt: next.updatedAt,
  }) ?? meeting;
  emitEvent({
    type: "meeting.google.updated",
    actorId: actor.userId,
    investorId: meeting.investorId,
    payload: { meetingId: meeting.id, googleEventId: next.id },
  });
  logAudit({
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "investidores",
    action: "Google Calendar · evento atualizado",
    target: meeting.investorName,
    details: `Evento ${next.id} · ID interno ${meeting.id}`,
    severity: "info",
  });
  return patched;
}

/** Cancela o evento Google (e o Meet). */
export async function syncDelete(meeting: Meeting, actor: Actor): Promise<void> {
  if (!meeting.googleEventId) return;
  try {
    await requireToken(actor);
  } catch (err) {
    markFailure(meeting, actor, err);
    return;
  }
  const all = safeRead();
  const idx = all.findIndex((e) => e.id === meeting.googleEventId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], cancelled: true, updatedAt: new Date().toISOString() };
  safeWrite(all);
  emitEvent({
    type: "meeting.google.deleted",
    actorId: actor.userId,
    investorId: meeting.investorId,
    payload: { meetingId: meeting.id, googleEventId: meeting.googleEventId },
  });
  logAudit({
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "investidores",
    action: "Google Calendar · evento cancelado",
    target: meeting.investorName,
    details: `Evento ${meeting.googleEventId} cancelado · Meet encerrado.`,
    severity: "warning",
  });
}

function markFailure(meeting: Meeting, actor: Actor, err: unknown): void {
  const message = err instanceof Error ? err.message : "Falha desconhecida.";
  applyGoogleSyncPatch(meeting.id, {
    googleSync: "failed",
    googleSyncError: message,
  });
  emitEvent({
    type: "meeting.google.failed",
    actorId: actor.userId,
    investorId: meeting.investorId,
    payload: { meetingId: meeting.id, error: message },
  });
  logAudit({
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "investidores",
    action: "Google Calendar · falha de sincronização",
    target: meeting.investorName,
    details: `Erro: ${message}`,
    severity: "critical",
  });
}

/**
 * Orquestração: chamada pela UI após criar/atualizar/excluir uma reunião.
 * Nunca lança — apenas registra falha e mantém o registro interno.
 */
export async function trySyncCreate(meeting: Meeting, actor: Actor): Promise<Meeting> {
  const store = getGoogleStore(actor.userId);
  if (store.state !== "connected" || !store.account) {
    applyGoogleSyncPatch(meeting.id, { googleSync: "none" });
    return meeting;
  }
  applyGoogleSyncPatch(meeting.id, { googleSync: "pending" });
  try {
    return await syncCreate(meeting, actor);
  } catch (err) {
    markFailure(meeting, actor, err);
    return { ...meeting, googleSync: "failed" };
  }
}

export async function trySyncUpdate(meeting: Meeting, actor: Actor): Promise<Meeting> {
  const store = getGoogleStore(actor.userId);
  if (store.state !== "connected" || !store.account) {
    applyGoogleSyncPatch(meeting.id, { googleSync: "none" });
    return meeting;
  }
  applyGoogleSyncPatch(meeting.id, { googleSync: "pending" });
  try {
    return await syncUpdate(meeting, actor);
  } catch (err) {
    markFailure(meeting, actor, err);
    return { ...meeting, googleSync: "failed" };
  }
}

export async function trySyncDelete(meeting: Meeting, actor: Actor): Promise<void> {
  const store = getGoogleStore(actor.userId);
  if (store.state !== "connected" || !meeting.googleEventId) return;
  try {
    await syncDelete(meeting, actor);
  } catch (err) {
    markFailure(meeting, actor, err);
  }
}

/** Sincroniza todas as reuniões pendentes ou com falha do executivo. */
export async function syncPending(actor: Actor): Promise<{ synced: number; failed: number; skipped: number }> {
  const store = getGoogleStore(actor.userId);
  if (store.state !== "connected") return { synced: 0, failed: 0, skipped: 0 };
  const pending = listMeetings({ executiveId: actor.userId }).filter(
    (m) =>
      m.status !== "Cancelada" &&
      m.status !== "Concluída" &&
      (!m.googleEventId || m.googleSync === "pending" || m.googleSync === "failed" || m.googleSync === "none"),
  );
  let synced = 0;
  let failed = 0;
  for (const m of pending) {
    const before = m.googleSync;
    const result = m.googleEventId
      ? await trySyncUpdate(m, actor)
      : await trySyncCreate(m, actor);
    if (result.googleSync === "synced") synced += 1;
    else if (result.googleSync === "failed") failed += 1;
    else if (before === result.googleSync) failed += 0;
  }
  emitEvent({
    type: "meeting.google.synced",
    actorId: actor.userId,
    payload: { synced, failed, total: pending.length },
  });
  logAudit({
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "investidores",
    action: "Google Calendar · sincronização manual",
    target: `${pending.length} reunião(ões)`,
    details: `Sincronizadas: ${synced} · Falhas: ${failed}.`,
    severity: failed > 0 ? "warning" : "info",
  });
  return { synced, failed, skipped: 0 };
}

/** Recupera o evento associado (para debug/timeline). */
export function getEvent(eventId: string | undefined | null): GoogleCalendarEvent | null {
  if (!eventId) return null;
  return safeRead().find((e) => e.id === eventId) ?? null;
}