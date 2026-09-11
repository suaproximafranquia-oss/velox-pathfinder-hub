/**
 * MATERIAL / APRESENTAÇÃO — REGISTRO ESTRUTURADO.
 *
 * O ramo E4 → E5 → E6 → E7 → E8 NÃO nasce por chegar na etapa: ele só
 * existe quando o executivo registra, de forma estruturada, que:
 *
 *  - o investidor PEDIU o material  → MATERIAL_REQUESTED
 *  - o material foi DISPONIBILIZADO → CONTENT_SENT
 *
 * Os dois registros são idempotentes (chave determinística por lead), não
 * apagam nada e não enviam mensagem nenhuma: são apenas o fato que
 * autoriza o motor a seguir.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { envNow } from "@/server/time/environment-clock.server";

export type MaterialEventType = "MATERIAL_REQUESTED" | "CONTENT_SENT";

const SCOPE = "production";

export async function registerMaterialEvent(input: {
  leadId: string;
  type: MaterialEventType;
  step?: string | null;
  actorId?: string | null;
  note?: string | null;
}): Promise<{ ok: boolean; created: boolean; reason?: string }> {
  const eventKey = `${input.type.toLowerCase()}_${input.leadId}`;
  const { data: existing } = await supabaseAdmin
    .from("relationship_events")
    .select("id")
    .eq("scope", SCOPE)
    .eq("event_key", eventKey)
    .maybeSingle();
  if (existing) return { ok: true, created: false };

  const { error } = await supabaseAdmin.from("relationship_events").insert({
    scope: SCOPE,
    lead_id: input.leadId,
    event_key: eventKey,
    type: input.type,
    step: input.step ?? null,
    occurred_at: envNow().toISOString(),
    historical: false,
    data: {
      actor_id: input.actorId ?? null,
      note: input.note ?? null,
    },
  } as never);
  if (error) return { ok: false, created: false, reason: error.message };
  return { ok: true, created: true };
}

/** Estado atual do material, para exibição na Ação do Dia. */
export async function materialStatus(leadId: string): Promise<{
  requested: boolean;
  sent: boolean;
}> {
  const { data } = await supabaseAdmin
    .from("relationship_events")
    .select("type")
    .eq("scope", SCOPE)
    .eq("lead_id", leadId)
    .in("type", ["CONTENT_SENT", "MATERIAL_REQUESTED"]);
  const types = new Set(((data ?? []) as { type: string }[]).map((r) => r.type));
  return { requested: types.has("MATERIAL_REQUESTED"), sent: types.has("CONTENT_SENT") };
}
