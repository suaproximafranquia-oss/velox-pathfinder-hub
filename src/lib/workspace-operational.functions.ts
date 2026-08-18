import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkspaceOperationalPatch = {
  id: string;
  notes?: string;
  viewedAt?: string | null;
  closedAt?: string | null;
  commercialState?: "journey" | "active" | "archived";
  journeyStartedAt?: string | null;
  relationshipStartedAt?: string | null;
  relationshipStartedBy?: string | null;
  relationshipStartedByName?: string | null;
  relationshipSource?: "executive" | "investor_request" | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;
  isPrivate?: boolean;
  ownershipClaimedAt?: string | null;
  ownershipOrigin?: string | null;
  responsibleExecutiveId?: string | null;
  lastOutboundAt?: string | null;
  lastInboundAt?: string | null;
  conversationWindowOpenedAt?: string | null;
};

export const updateWorkspaceOperational = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: WorkspaceOperationalPatch) => data)
  .handler(async ({ data, context }) => {
    const patch = {
      notes: data.notes,
      viewed_at: data.viewedAt,
      closed_at: data.closedAt,
      commercial_state: data.commercialState,
      journey_started_at: data.journeyStartedAt,
      relationship_started_at: data.relationshipStartedAt,
      relationship_started_by: data.relationshipStartedBy,
      relationship_started_by_name: data.relationshipStartedByName,
      relationship_source: data.relationshipSource,
      archived_at: data.archivedAt,
      archived_by: data.archivedBy,
      restored_at: data.restoredAt,
      restored_by: data.restoredBy,
      is_private: data.isPrivate,
      ownership_claimed_at: data.ownershipClaimedAt,
      ownership_origin: data.ownershipOrigin,
      responsible_executive_id: data.responsibleExecutiveId,
      last_outbound_at: data.lastOutboundAt,
      last_inbound_at: data.lastInboundAt,
      conversation_window_opened_at: data.conversationWindowOpenedAt,
    };
    if (Object.values(patch).every((value) => value === undefined)) return { ok: true as const };
    const { error } = await context.supabase.from("portal_leads").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });