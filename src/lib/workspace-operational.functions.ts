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
    const patch: Record<string, string | boolean | null> = {};
    if (data.notes !== undefined) patch["notes"] = data.notes;
    if (data.viewedAt !== undefined) patch["viewed_at"] = data.viewedAt;
    if (data.closedAt !== undefined) patch["closed_at"] = data.closedAt;
    if (data.commercialState !== undefined) patch["commercial_state"] = data.commercialState;
    if (data.journeyStartedAt !== undefined) patch["journey_started_at"] = data.journeyStartedAt;
    if (data.relationshipStartedAt !== undefined) patch["relationship_started_at"] = data.relationshipStartedAt;
    if (data.relationshipStartedBy !== undefined) patch["relationship_started_by"] = data.relationshipStartedBy;
    if (data.relationshipStartedByName !== undefined) patch["relationship_started_by_name"] = data.relationshipStartedByName;
    if (data.relationshipSource !== undefined) patch["relationship_source"] = data.relationshipSource;
    if (data.archivedAt !== undefined) patch["archived_at"] = data.archivedAt;
    if (data.archivedBy !== undefined) patch["archived_by"] = data.archivedBy;
    if (data.restoredAt !== undefined) patch["restored_at"] = data.restoredAt;
    if (data.restoredBy !== undefined) patch["restored_by"] = data.restoredBy;
    if (data.isPrivate !== undefined) patch["is_private"] = data.isPrivate;
    if (data.ownershipClaimedAt !== undefined) patch["ownership_claimed_at"] = data.ownershipClaimedAt;
    if (data.ownershipOrigin !== undefined) patch["ownership_origin"] = data.ownershipOrigin;
    if (data.responsibleExecutiveId !== undefined) patch["responsible_executive_id"] = data.responsibleExecutiveId;
    if (data.lastOutboundAt !== undefined) patch["last_outbound_at"] = data.lastOutboundAt;
    if (data.lastInboundAt !== undefined) patch["last_inbound_at"] = data.lastInboundAt;
    if (data.conversationWindowOpenedAt !== undefined) {
      patch["conversation_window_opened_at"] = data.conversationWindowOpenedAt;
    }
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await context.supabase.from("portal_leads").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });