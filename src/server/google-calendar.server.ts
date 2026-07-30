/** Operações reais no Google Calendar / Meet — SERVER ONLY. */
import { googleFetch } from "@/server/google.server";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export type CalendarEventInput = {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  attendees?: string[];
  timeZone?: string;
  withMeet?: boolean;
  internalId?: string;
};

export type CalendarEventResult = {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
  status: string | null;
  start: string | null;
  end: string | null;
  summary: string | null;
};

type RawEvent = {
  id?: string;
  status?: string;
  htmlLink?: string;
  summary?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
};

function meetUrlOf(ev: RawEvent | null): string | null {
  if (!ev) return null;
  if (ev.hangoutLink) return ev.hangoutLink;
  const entry = ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return entry?.uri ?? null;
}

function toResult(ev: RawEvent | null): CalendarEventResult {
  return {
    eventId: ev?.id ?? "",
    meetUrl: meetUrlOf(ev),
    htmlLink: ev?.htmlLink ?? null,
    status: ev?.status ?? null,
    start: ev?.start?.dateTime ?? ev?.start?.date ?? null,
    end: ev?.end?.dateTime ?? ev?.end?.date ?? null,
    summary: ev?.summary ?? null,
  };
}

function body(input: CalendarEventInput) {
  const timeZone = input.timeZone ?? DEFAULT_TIMEZONE;
  return {
    summary: input.summary,
    description: input.description ?? "",
    start: { dateTime: input.startIso, timeZone },
    end: { dateTime: input.endIso, timeZone },
    attendees: (input.attendees ?? []).map((email) => ({ email })),
    extendedProperties: input.internalId
      ? { private: { veloxMeetingId: input.internalId } }
      : undefined,
    conferenceData: input.withMeet
      ? {
          createRequest: {
            requestId: `velox-${input.internalId ?? Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        }
      : undefined,
  };
}

export async function createCalendarEvent(
  userId: string,
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  const query = new URLSearchParams({
    sendUpdates: "all",
    conferenceDataVersion: input.withMeet === false ? "0" : "1",
  });
  const ev = (await googleFetch(
    userId,
    "google_calendar",
    `/calendar/v3/calendars/primary/events?${query.toString()}`,
    { method: "POST", body: JSON.stringify(body({ withMeet: true, ...input })) },
  )) as RawEvent | null;
  return toResult(ev);
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  const query = new URLSearchParams({ sendUpdates: "all", conferenceDataVersion: "1" });
  const ev = (await googleFetch(
    userId,
    "google_calendar",
    `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?${query.toString()}`,
    { method: "PATCH", body: JSON.stringify(body({ withMeet: false, ...input })) },
  )) as RawEvent | null;
  return toResult(ev);
}

export async function cancelCalendarEvent(userId: string, eventId: string): Promise<void> {
  await googleFetch(
    userId,
    "google_calendar",
    `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE" },
  );
}

export async function getCalendarEvent(
  userId: string,
  eventId: string,
): Promise<CalendarEventResult | null> {
  try {
    const ev = (await googleFetch(
      userId,
      "google_calendar",
      `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    )) as RawEvent | null;
    return ev ? toResult(ev) : null;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("GOOGLE_API_ERROR:404")) return null;
    throw err;
  }
}

export type CalendarWindowEvent = CalendarEventResult & { internalId: string | null };

export async function listCalendarEvents(
  userId: string,
  timeMinIso: string,
  timeMaxIso: string,
): Promise<CalendarWindowEvent[]> {
  const query = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const data = (await googleFetch(
    userId,
    "google_calendar",
    `/calendar/v3/calendars/primary/events?${query.toString()}`,
  )) as { items?: RawEvent[] } | null;
  return (data?.items ?? []).map((ev) => ({
    ...toResult(ev),
    internalId: ev.extendedProperties?.private?.veloxMeetingId ?? null,
  }));
}