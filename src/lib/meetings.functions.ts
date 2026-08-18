import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Meeting } from "@/lib/meetings";

function toRow(meeting: Meeting) {
  return {
    id: meeting.id,
    investor_id: meeting.investorId,
    investor_name: meeting.investorName,
    investor_email: meeting.investorEmail ?? null,
    executive_id: meeting.executiveId,
    executive_name: meeting.executiveName,
    scheduled_at: meeting.scheduledAt,
    duration_min: meeting.durationMin ?? 60,
    status: meeting.status,
    meet_url: meeting.meetUrl ?? null,
    notes: meeting.notes as never,
    cancel_reason: meeting.cancelReason ?? null,
    requested_slots: (meeting.requestedSlots ?? []) as never,
    topic: meeting.topic ?? null,
    origin: meeting.origin ?? "executivo",
    google_event_id: meeting.googleEventId ?? null,
    google_sync: meeting.googleSync ?? "none",
    google_sync_error: meeting.googleSyncError ?? null,
    google_synced_at: meeting.googleSyncedAt ?? null,
    meeting_provider: meeting.meetingProvider ?? null,
    meeting_provider_status: meeting.meetingProviderStatus ?? null,
    meeting_provider_meeting_id: meeting.meetingProviderMeetingId ?? null,
    meeting_provider_url: meeting.meetingProviderUrl ?? null,
    created_at: meeting.createdAt,
    updated_at: meeting.updatedAt,
  };
}

export const listMeetingsFromServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("portal_meetings")
      .select("*")
      .order("scheduled_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertMeetingOnServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Meeting) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("portal_meetings")
      .upsert(toRow(data), { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteMeetingOnServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("portal_meetings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });