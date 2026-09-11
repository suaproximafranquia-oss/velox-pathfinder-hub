/**
 * ENCAMINHAMENTO (HANDOFF) — SAÍDA ESTRUTURADA DA ESPERA HUMANA.
 *
 * Quando o investidor ATENDE, a régua para: as ações restantes daquela
 * etapa são canceladas e o ciclo entra em AGUARDANDO_ENCAMINHAMENTO. O
 * motor não inventa o próximo passo — quem decide é o executivo.
 *
 * Aqui essa decisão vira fato:
 *   • MATERIAL_SOLICITADO → registra o pedido do material;
 *   • MATERIAL_ENVIADO    → registra a entrega (abre E5 → E6 → E7 → E8);
 *   • AGENDAMENTO         → a cadência permanece congelada pelo estágio;
 *   • SEM_INTERESSE       → segue a decisão de estágio, sem nova etapa;
 *   • RETOMAR_CADENCIA    → a régua volta a andar da etapa seguinte.
 *
 * Nada é apagado e nenhuma mensagem é enviada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registerMaterialEvent } from "@/server/relationship/material.server";
import { envNow } from "@/server/time/environment-clock.server";

export type HandoffDecision =
  | "MATERIAL_SOLICITADO"
  | "MATERIAL_ENVIADO"
  | "AGENDAMENTO"
  | "SEM_INTERESSE"
  | "RETOMAR_CADENCIA";

const SCOPE = "production";

export async function resolveHandoff(input: {
  leadId: string;
  decision: HandoffDecision;
  note?: string | null;
  actorId: string;
  executiveId?: string | null;
}): Promise<{ ok: boolean; resumed: boolean }> {
  const nowIso = envNow().toISOString();

  if (input.decision === "MATERIAL_SOLICITADO") {
    await registerMaterialEvent({
      leadId: input.leadId,
      type: "MATERIAL_REQUESTED",
      actorId: input.actorId,
      note: input.note ?? null,
    });
  }
  if (input.decision === "MATERIAL_ENVIADO") {
    // A entrega pressupõe o pedido: os dois fatos ficam registrados.
    await registerMaterialEvent({
      leadId: input.leadId,
      type: "MATERIAL_REQUESTED",
      actorId: input.actorId,
      note: input.note ?? null,
    });
    await registerMaterialEvent({
      leadId: input.leadId,
      type: "CONTENT_SENT",
      actorId: input.actorId,
      note: input.note ?? null,
    });
  }

  /**
   * A espera termina em todos os casos: a decisão humana existe. No
   * AGENDAMENTO quem mantém a cadência parada é o próprio estágio, não
   * a espera de encaminhamento.
   */
  await supabaseAdmin
    .from("relationship_cadences")
    .update({ awaiting_handoff: false, updated_at: nowIso } as never)
    .eq("scope", SCOPE)
    .eq("lead_id", input.leadId);

  await supabaseAdmin.from("relationship_engine_log").insert({
    scope: SCOPE,
    action: "handoff_resolvido",
    actor: input.executiveId ?? input.actorId,
    details: {
      leadId: input.leadId,
      decisao: input.decision,
      observacao: input.note ?? null,
      at: nowIso,
    } as never,
  } as never);

  return { ok: true, resumed: input.decision === "RETOMAR_CADENCIA" };
}
