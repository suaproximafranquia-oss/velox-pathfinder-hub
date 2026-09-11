import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { initialRecord, applyEvent } from "@/lib/relationship/machine";
import { RELATIONSHIP_CONFIG } from "@/lib/relationship/config";
import { getPublishedVersion } from "./flow-versions.server";

/** Uma submissão explícita = uma instância; retry usa a mesma chave/UUID. */
export async function openCommercialReentry(input: { leadId: string; submissionKey: string; at: string }): Promise<boolean> {
  if (!input.submissionKey || !Number.isFinite(Date.parse(input.at))) return false;
  const { data: lead, error: leadError } = await supabaseAdmin.from("portal_leads")
    .select("id,scope,origin").eq("id", input.leadId).maybeSingle();
  if (leadError) throw new Error(leadError.message);
  if (!lead || !["portal", "green_sales", "tiktok", "meta"].includes(lead.scope) || /velox (solar|seguros)/i.test(lead.origin)) return false;
  const key = `reentry:${input.leadId}:${input.submissionKey}`;
  const hex = createHash("sha256").update(key).digest("hex");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const { data: replay, error: replayError } = await supabaseAdmin.from("relationship_cadences").select("id,active").eq("id", id).maybeSingle();
  if (replayError) throw new Error(replayError.message);
  if (replay) {
    if (replay.active) await finishOpening(input.leadId, key, input.at);
    return true;
  }
  const { data: latest, error: latestError } = await supabaseAdmin.from("relationship_cadences")
    .select("id,instance_seq,active,started_at").eq("scope", "production").is("run_id", null)
    .eq("lead_id", input.leadId).order("instance_seq", { ascending: false }).limit(1).maybeSingle();
  if (latestError) throw new Error(latestError.message);
  if (latest?.started_at && Date.parse(latest.started_at) >= Date.parse(input.at)) return false;
  const now = new Date().toISOString();
  // O fechamento mira SOMENTE o ciclo lido: nunca fecha o vencedor de uma corrida.
  if (latest?.active) {
    const { error } = await supabaseAdmin.from("relationship_cadences")
      .update({ active: false, ended_at: now, closed_at: now, close_reason: "nova_submissao_comercial", updated_at: now })
      .eq("id", latest.id).eq("active", true);
    if (error) throw new Error(error.message);
  }
  const published = await getPublishedVersion("reentrada").catch(() => null);
  const record = applyEvent(initialRecord({ scope: "production", leadId: input.leadId, at: input.at }), {
    id: key, scope: "production", leadId: input.leadId, type: "LEAD_CREATED", at: input.at,
    data: { manualE0: true, reentry: true },
  }, RELATIONSHIP_CONFIG).record;
  const { error } = await supabaseAdmin.from("relationship_cadences").insert({
    id, scope: "production", run_id: null, lead_id: input.leadId,
    instance_seq: (latest?.instance_seq ?? 0) + 1, active: true, opened_reason: key,
    state: record.state, flow: record.flow, current_step: record.currentStep,
    started_at: input.at, operational_since: input.at, started_by: record.startedBy,
    last_event_type: "LEAD_CREATED", last_event_at: input.at, executed_steps: [],
    flow_version_id: published?.id ?? null, flow_version: published?.version ?? null,
    updated_at: now,
  });
  if (error) {
    if (error.code !== "23505") throw new Error(error.message);
    const { data: winner } = await supabaseAdmin.from("relationship_cadences").select("id,active").eq("id", id).maybeSingle();
    if (!winner) throw new Error("Outra entrada está sendo concluída. Tente novamente.");
    if (!winner.active) return true;
  }
  await finishOpening(input.leadId, key, input.at);
  return true;
}

async function finishOpening(leadId: string, key: string, at: string) {
  const { data: current, error } = await supabaseAdmin.from("relationship_cadences")
    .select("instance_seq,opened_reason,created_at").eq("scope", "production").is("run_id", null)
    .eq("lead_id", leadId).eq("active", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (current?.opened_reason !== key) return;
  // Preserva linhas/resultado históricos. Só neutraliza obrigações abertas anteriores.
  const { error: queueError } = await supabaseAdmin.from("relationship_queue")
    .update({ status: "CANCELLED", cancel_reason: "nova_submissao_comercial", reason: "Ciclo anterior preservado; nova entrada comercial.", updated_at: new Date().toISOString() })
    .eq("scope", "production").is("run_id", null).eq("lead_id", leadId)
    .in("status", ["PENDING", "PROCESSING"]).lt("action_order", current.instance_seq * 100)
    .lte("created_at", current.created_at);
  if (queueError) throw new Error(queueError.message);
  const { error: eventError } = await supabaseAdmin.from("relationship_events").upsert({
    scope: "production", lead_id: leadId, event_key: key, type: "LEAD_CREATED", occurred_at: at,
    data: { reentry: true, submissionKey: key, instanceSeq: current.instance_seq },
  }, { onConflict: "scope,event_key", ignoreDuplicates: true });
  if (eventError) throw new Error(eventError.message);
  const { closePendingE0Actions } = await import("@/server/crm/e0-actions.server");
  await closePendingE0Actions({ cardId: leadId, reason: "Nova entrada comercial: RE0, sem segunda E0." });
  const { productionEngine } = await import("./engine.server");
  await productionEngine().tick(leadId);
}