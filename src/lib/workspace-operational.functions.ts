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
    if (Object.values(patch).every((value) => value === undefined)) {
      return { ok: true as const, updated: 0 };
    }

    /**
     * CAMPOS OPERACIONAIS (visualizado / encerrado / anotação).
     *
     * A política de UPDATE de `portal_leads` continua exatamente como
     * está: a Gestora não pode alterar identidade, proprietário, escopo
     * ou dados comerciais. Para os TRÊS campos operacionais usamos uma
     * função dedicada no banco, que autoriza administrador, executivo
     * responsável e Gestora — apenas nos leads que ela já enxerga — e
     * grava somente esses campos. Antes, o UPDATE bloqueado atingia 0
     * linhas SEM erro e o Workspace exibia um estado que não existia.
     */
    const operationalOnly =
      patch.viewed_at !== undefined ||
      patch.closed_at !== undefined ||
      patch.notes !== undefined;
    const otherFields = Object.entries(patch).filter(
      ([key, value]) =>
        value !== undefined && !["viewed_at", "closed_at", "notes"].includes(key),
    );

    let updated = 0;

    if (operationalOnly) {
      const { data: affected, error: rpcError } = await context.supabase.rpc(
        "set_lead_operational",
        {
          _id: data.id,
          _viewed_at: patch.viewed_at ?? null,
          _closed_at: patch.closed_at ?? null,
          _notes: patch.notes ?? null,
          _set_viewed: patch.viewed_at !== undefined,
          _set_closed: patch.closed_at !== undefined,
          _set_notes: patch.notes !== undefined,
        } as never,
      );
      if (rpcError) throw new Error(rpcError.message);
      updated = Number(affected ?? 0);
      if (updated === 0) {
        throw new Error("Lead não encontrado ou sem permissão para esta operação.");
      }
    }

    if (otherFields.length > 0) {
      const rest = Object.fromEntries(otherFields) as Record<string, never>;
      const { count, error } = await context.supabase
        .from("portal_leads")
        .update(rest, { count: "exact" })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      if (!count) {
        throw new Error("Alteração não autorizada para este lead.");
      }
      updated = Math.max(updated, count);
    }

    return { ok: true as const, updated };
  });