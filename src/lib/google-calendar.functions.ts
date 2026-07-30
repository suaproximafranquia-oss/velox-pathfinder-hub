import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CalendarEventPayload = {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  attendees?: string[];
  internalId?: string;
  withMeet?: boolean;
};

export const createGoogleEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CalendarEventPayload) => data)
  .handler(async ({ data, context }) => {
    const { createCalendarEvent } = await import("@/server/google-calendar.server");
    return createCalendarEvent(context.userId, data);
  });

export const updateGoogleEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CalendarEventPayload & { eventId: string }) => data)
  .handler(async ({ data, context }) => {
    const { updateCalendarEvent } = await import("@/server/google-calendar.server");
    const { eventId, ...input } = data;
    return updateCalendarEvent(context.userId, eventId, input);
  });

export const cancelGoogleEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string }) => data)
  .handler(async ({ data, context }) => {
    const { cancelCalendarEvent } = await import("@/server/google-calendar.server");
    await cancelCalendarEvent(context.userId, data.eventId);
    return { ok: true as const };
  });

export const listGoogleEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { timeMinIso: string; timeMaxIso: string }) => data)
  .handler(async ({ data, context }) => {
    const { listCalendarEvents } = await import("@/server/google-calendar.server");
    return listCalendarEvents(context.userId, data.timeMinIso, data.timeMaxIso);
  });