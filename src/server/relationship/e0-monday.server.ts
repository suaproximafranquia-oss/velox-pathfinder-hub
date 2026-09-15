/** Reconciliador estrito da E0 para a segunda-feira operacional atual. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, weekdayOf } from "@/lib/relationship/calendar";
import { e0StructureDate, localDateOf } from "@/lib/relationship/cadence-v2";

export async function reconcileMondayE0(nowIso: string = new Date().toISOString()): Promise<number> {
  const date = localDateOf(nowIso);
  if (weekdayOf(date) !== 1) return 0;
  const { data: pending, error: pendingError } = await supabaseAdmin
    .from("relationship_queue")
    .select("id,lead_id,origin_date")
    .eq("scope", "production")
    .is("run_id", null)
    .eq("step", "E0")
    .eq("action_order", 2)
    .eq("action_kind", "call")
    .eq("status", "PENDING");
  if (pendingError) throw new Error(pendingError.message);
  if (!pending?.length) return 0;

  const ids = pending
    .filter((row) => e0StructureDate(row.origin_date ?? date, nowIso, []) === date)
    .map((row) => row.id);
  if (ids.length === 0) return 0;
  const { data: cancelled, error: cancelError } = await supabaseAdmin
    .from("relationship_queue")
    .update({
      status: "CANCELLED",
      cancel_reason: "monday_e0_single_call",
      reason: "Segunda-feira operacional — E0 possui somente uma ligação.",
      updated_at: nowIso,
    } as never)
    .in("id", ids)
    .eq("status", "PENDING")
    .select("lead_id");
  if (cancelError) throw new Error(cancelError.message);

  const leadIds = [...new Set((cancelled ?? []).map((row) => row.lead_id))];
  if (leadIds.length > 0) {
    const { productionEngine } = await import("./engine.server");
    for (const leadId of leadIds) await productionEngine().tick(leadId);
  }
  return leadIds.length;
}