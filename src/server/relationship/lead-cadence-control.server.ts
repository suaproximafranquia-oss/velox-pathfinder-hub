import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  NEGOTIATION_CLOSED_CANCEL_REASON,
  supportsWorkspaceCadenceControl,
} from "@/lib/relationship/lead-cadence-closure";
import { productionEngine } from "./engine.server";

export async function syncWorkspaceLeadCadenceState(input: {
  leadId: string;
  closedAt: string | null;
  previousClosedAt: string | null;
  actorId: string;
}): Promise<{ controlled: boolean }> {
  const { data: lead, error } = await supabaseAdmin
    .from("portal_leads")
    .select("scope,closed_at")
    .eq("id", input.leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead || !supportsWorkspaceCadenceControl(lead.scope)) return { controlled: false };

  // O valor confirmado no banco governa; uma requisição concorrente vencida
  // não pode interromper ou retomar o ciclo em desacordo com `closed_at`.
  const persistedClosedAt = lead.closed_at ?? null;
  if (persistedClosedAt !== input.closedAt) return { controlled: true };

  const at = new Date().toISOString();
  const operationKey = input.closedAt ?? input.previousClosedAt ?? at;
  const { data: activeCadence, error: cadenceError } = await supabaseAdmin
    .from("relationship_cadences")
    .select("id")
    .eq("scope", "production")
    .is("run_id", null)
    .eq("lead_id", input.leadId)
    .eq("active", true)
    .order("instance_seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cadenceError) throw new Error(cadenceError.message);
  // Encerrar um card antes de sua E0 existir não cria ciclo artificial.
  if (!activeCadence && input.closedAt) return { controlled: true };
  // Reabrir um card sem ciclo deixa a reconciliação normal abrir a E0.
  if (!activeCadence && !input.closedAt) {
    const { ensureManualE0Cadences } = await import("./e0-manual.server");
    await ensureManualE0Cadences();
    return { controlled: true };
  }
  await productionEngine().handleEvent({
    id: `workspace-negotiation:${input.leadId}:${input.closedAt ? "closed" : "reopened"}:${operationKey}`,
    scope: "production",
    leadId: input.leadId,
    type: input.closedAt ? "MANUAL_INTERRUPTION" : "MANUAL_RESUME",
    at,
    data: input.closedAt
      ? {
          actorId: input.actorId,
          cancelReason: NEGOTIATION_CLOSED_CANCEL_REASON,
          preserveProcessing: true,
          source: "workspace_closed_at",
        }
      : {
          actorId: input.actorId,
          source: "workspace_closed_at",
        },
  });

  return { controlled: true };
}