/**
 * Google Calendar / Meet — integração real (Épico 8).
 *
 * As operações são executadas no servidor com a credencial individual do
 * executivo (App User Connector). O espelho local guarda apenas dados não
 * sensíveis dos eventos criados, usados para detectar conflitos de agenda
 * de forma instantânea na interface.
 */
import { emitEvent } from "@/lib/events/bus";
import { logAudit } from "@/lib/audit-log";
import { getGoogleStore, isConnectorConnected, refreshGoogleStore } from "@/lib/google-workspace";
import {
  cancelGoogleEvent,
  createGoogleEvent,
  listGoogleEvents,
  updateGoogleEvent,
} from "@/lib/google-calendar.functions";
import { applyGoogleSyncPatch, listMeetings, type Meeting } from "@/lib/meetings";

export type GoogleCalendarEvent = {
  id: string;
  ownerId: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  timeZone: string;
  attendees: string[];
  meetUrl: string;
  meetingId: string;
  updatedAt: string;
  cancelled?: boolean;
  htmlLink?: string;
};

const STORAGE_KEY = "velox:google-calendar:v2";

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

function upsertMirror(event: GoogleCalendarEvent) {
  const all = safeRead();
  const idx = all.findIndex((e) => e.id === event.id);
  if (idx >= 0) all[idx] = event;
  else all.push(event);
  safeWrite(all);
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

/** Conflitos conhecidos na agenda do executivo (espelho local). */
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

/**
 * A Conta Google é corporativa: se o cache local ainda não conhece a
 * conexão, consulta o servidor antes de recusar a sincronização.
 */
async function requireConnected(actor: Actor) {
  let store = getGoogleStore(actor.userId);
  if (!isConnectorConnected(store, "google_calendar")) {
    store = await refreshGoogleStore(actor.userId);
  }
  if (!isConnectorConnected(store, "google_calendar")) {
    throw new Error("Conta Google desconectada.");
  }
  return store;
}

/** Cria o evento real no Calendar com link oficial do Google Meet. */
export async function syncCreate(meeting: Meeting, actor: Actor): Promise<Meeting> {
  const store = await requireConnected(actor);
  const executiveEmail = actor.email ?? store.account?.email;
  const start = meeting.scheduledAt;
  const end = endOf(meeting);
  const created = await createGoogleEvent({
    data: {
      summary: summaryOf(meeting),
      description: descriptionOf(meeting),
      startIso: start,
      endIso: end,
      attendees: attendeesOf(meeting, executiveEmail),
      internalId: meeting.id,
      withMeet: true,
    },
  });
  const updatedAt = new Date().toISOString();
  upsertMirror({
    id: created.eventId,
    ownerId: actor.userId,
    summary: summaryOf(meeting),
    description: descriptionOf(meeting),
    start,
    end,
    timeZone: DEFAULT_TIMEZONE,
    attendees: attendeesOf(meeting, executiveEmail),
    meetUrl: created.meetUrl ?? "",
    meetingId: meeting.id,
    updatedAt,
    htmlLink: created.htmlLink ?? undefined,
  });
  const patched =
    applyGoogleSyncPatch(meeting.id, {
      googleEventId: created.eventId,
      meetUrl: created.meetUrl ?? undefined,
      googleSync: "synced",
      googleSyncError: null,
      googleSyncedAt: updatedAt,
    }) ?? meeting;
  emitEvent({
    type: "meeting.google.created",
    actorId: actor.userId,
    investorId: meeting.investorId,
    payload: { meetingId: meeting.id, googleEventId: created.eventId, meetUrl: created.meetUrl },
  });
  logAudit({
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "investidores",
    action: "Google Calendar · evento criado",
    target: meeting.investorName,
    details: `Evento ${created.eventId} · Meet ${created.meetUrl ?? "—"} · convites enviados por e-mail · ID interno ${meeting.id}`,
    severity: "success",
  });
  return patched;
}

/** Atualiza data/hora/descrição/participantes do evento real. */
export async function syncUpdate(meeting: Meeting, actor: Actor): Promise<Meeting> {
  if (!meeting.googleEventId) return syncCreate(meeting, actor);
  const store = await requireConnected(actor);
  const executiveEmail = actor.email ?? store.account?.email;
  const start = meeting.scheduledAt;
  const end = endOf(meeting);
  const updated = await updateGoogleEvent({
    data: {
      eventId: meeting.googleEventId,
      summary: summaryOf(meeting),
      description: descriptionOf(meeting),
      startIso: start,
      endIso: end,
      attendees: attendeesOf(meeting, executiveEmail),
      internalId: meeting.id,
    },
  });
  const updatedAt = new Date().toISOString();
  upsertMirror({
    id: updated.eventId || meeting.googleEventId,
    ownerId: actor.userId,
    summary: summaryOf(meeting),
    description: descriptionOf(meeting),
    start,
    end,
    timeZone: DEFAULT_TIMEZONE,
    attendees: attendeesOf(meeting, executiveEmail),
    meetUrl: updated.meetUrl ?? meeting.meetUrl ?? "",
    meetingId: meeting.id,
    updatedAt,
    cancelled: false,
  });
  const patched =
    applyGoogleSyncPatch(meeting.id, {
      meetUrl: updated.meetUrl ?? meeting.meetUrl ?? undefined,
      googleSync: "synced",
      googleSyncError: null,
      googleSyncedAt: updatedAt,
    }) ?? meeting;
  emitEvent({
    type: "meeting.google.updated",
    actorId: actor.userId,
    investorId: meeting.investorId,
    payload: { meetingId: meeting.id, googleEventId: meeting.googleEventId },
  });
  logAudit({
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "investidores",
    action: "Google Calendar · evento atualizado",
    target: meeting.investorName,
    details: `Evento ${meeting.googleEventId} · ID interno ${meeting.id}`,
    severity: "info",
  });
  return patched;
}

/** Cancela o evento real (e o Meet), notificando os participantes. */
export async function syncDelete(meeting: Meeting, actor: Actor): Promise<void> {
  if (!meeting.googleEventId) return;
  try {
    await requireConnected(actor);
    await cancelGoogleEvent({ data: { eventId: meeting.googleEventId } });
  } catch (err) {
    markFailure(meeting, actor, err);
    return;
  }
  const all = safeRead();
  const idx = all.findIndex((e) => e.id === meeting.googleEventId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], cancelled: true, updatedAt: new Date().toISOString() };
    safeWrite(all);
  }
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
    details: `Evento ${meeting.googleEventId} cancelado · participantes notificados.`,
    severity: "warning",
  });
}

function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Falha desconhecida.";
  if (raw.startsWith("GOOGLE_NOT_CONNECTED")) return "Conta Google desconectada.";
  if (raw.startsWith("GOOGLE_API_ERROR")) {
    const [, status] = raw.split(":");
    return `O Google recusou a operação (código ${status}).`;
  }
  return raw;
}

function markFailure(meeting: Meeting, actor: Actor, err: unknown): void {
  const message = friendlyError(err);
  applyGoogleSyncPatch(meeting.id, { googleSync: "failed", googleSyncError: message });
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

async function connected(actor: Actor): Promise<boolean> {
  const store = getGoogleStore(actor.userId);
  if (isConnectorConnected(store, "google_calendar")) return true;
  return isConnectorConnected(await refreshGoogleStore(actor.userId), "google_calendar");
}

export async function trySyncCreate(meeting: Meeting, actor: Actor): Promise<Meeting> {
  if (!(await connected(actor))) {
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
  if (!(await connected(actor))) {
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
  if (!meeting.googleEventId || !(await connected(actor))) return;
  try {
    await syncDelete(meeting, actor);
  } catch (err) {
    markFailure(meeting, actor, err);
  }
}

/**
 * Sincronização bidirecional: envia o que está pendente e traz de volta
 * horários/links alterados diretamente no Google Agenda.
 */
export async function syncPending(
  actor: Actor,
): Promise<{ synced: number; failed: number; skipped: number }> {
  if (!connected(actor)) return { synced: 0, failed: 0, skipped: 0 };
  const meetings = listMeetings({ executiveId: actor.userId }).filter(
    (m) => m.status !== "Cancelada" && m.status !== "Concluída",
  );
  const pending = meetings.filter(
    (m) =>
      !m.googleEventId ||
      m.googleSync === "pending" ||
      m.googleSync === "failed" ||
      m.googleSync === "none",
  );
  let synced = 0;
  let failed = 0;
  for (const m of pending) {
    const result = m.googleEventId ? await trySyncUpdate(m, actor) : await trySyncCreate(m, actor);
    if (result.googleSync === "synced") synced += 1;
    else if (result.googleSync === "failed") failed += 1;
  }

  // Retorno do Google → Portal (mudanças feitas diretamente na agenda).
  let pulled = 0;
  try {
    const now = Date.now();
    const remote = await listGoogleEvents({
      data: {
        timeMinIso: new Date(now - 30 * 24 * 3600_000).toISOString(),
        timeMaxIso: new Date(now + 180 * 24 * 3600_000).toISOString(),
      },
    });
    for (const ev of remote) {
      const meeting = meetings.find(
        (m) => m.googleEventId === ev.eventId || (ev.internalId && m.id === ev.internalId),
      );
      if (!meeting || !ev.start) continue;
      const changedTime = new Date(ev.start).toISOString() !== new Date(meeting.scheduledAt).toISOString();
      const changedLink = Boolean(ev.meetUrl) && ev.meetUrl !== meeting.meetUrl;
      if (!changedTime && !changedLink) continue;
      applyGoogleSyncPatch(meeting.id, {
        googleEventId: ev.eventId,
        meetUrl: ev.meetUrl ?? meeting.meetUrl ?? undefined,
        scheduledAt: changedTime ? new Date(ev.start).toISOString() : undefined,
        googleSync: "synced",
        googleSyncError: null,
        googleSyncedAt: new Date().toISOString(),
      });
      pulled += 1;
    }
  } catch {
    /* a leitura reversa nunca invalida o envio */
  }

  emitEvent({
    type: "meeting.google.synced",
    actorId: actor.userId,
    payload: { synced, failed, pulled, total: pending.length },
  });
  logAudit({
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "investidores",
    action: "Google Calendar · sincronização bidirecional",
    target: `${pending.length} reunião(ões)`,
    details: `Enviadas: ${synced} · Falhas: ${failed} · Atualizadas pelo Google: ${pulled}.`,
    severity: failed > 0 ? "warning" : "info",
  });
  return { synced, failed, skipped: pulled };
}

/** Evento espelhado localmente (timeline/debug). */
export function getEvent(eventId: string | undefined | null): GoogleCalendarEvent | null {
  if (!eventId) return null;
  return safeRead().find((e) => e.id === eventId) ?? null;
}