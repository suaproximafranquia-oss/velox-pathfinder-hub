/**
 * OPORTUNIDADE ENCERRA O CICLO AUTOMÁTICO — SERVER ONLY.
 *
 * OPORTUNIDADE é etapa TERMINAL: a partir dela quem conduz é o
 * executivo, não o motor. Este módulo encerra a ocorrência ativa da
 * Apresentação Digital (E20) e, com ela, as obrigações de fechamento
 * (E27 e FINALIZAÇÃO) que ainda não venceram ou não foram executadas.
 *
 * REGRAS:
 *  • nada é apagado — a ocorrência recebe `closed_at` e o motivo
 *    `oportunidade`, ficando auditável;
 *  • mensagens já enviadas e snapshots permanecem intocados;
 *  • o cancelamento é idempotente: ocorrência já encerrada é ignorada;
 *  • funciona nos dois cenários exigidos — no instante da mudança de
 *    etapa e na varredura do motor (leads que já estavam em
 *    OPORTUNIDADE antes desta correção).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TERMINAL_STAGES } from "@/lib/relationship/closing";

export const OPPORTUNITY_CLOSE_REASON = "oportunidade";

export type OpportunityClosure = {
  occurrenceId: string;
  leadId: string;
};

/** Encerra o ciclo da Apresentação Digital de UM lead (por external id). */
export async function closeCycleForOpportunity(
  leadId: string,
  nowIso?: string,
): Promise<OpportunityClosure[]> {
  const at = nowIso ?? new Date().toISOString();

  const { data } = await supabaseAdmin
    .from("relationship_e20_occurrences")
    .select("id,lead_id")
    .eq("lead_id", leadId)
    .is("closed_at", null);

  const open = (data ?? []) as any[];
  if (open.length === 0) return [];

  await supabaseAdmin
    .from("relationship_e20_occurrences")
    .update({
      status: "encerrada",
      closed_at: at,
      close_reason: OPPORTUNITY_CLOSE_REASON,
    } as any)
    .eq("lead_id", leadId)
    .is("closed_at", null);

  for (const row of open) {
    await supabaseAdmin.from("crm_timeline").insert({
      id: `tl_oportunidade_${row.id}`,
      investor_id: String(row.lead_id),
      event: "ciclo_encerrado_oportunidade",
      origin: "motor_relacionamento",
      reason:
        "Lead em OPORTUNIDADE: o executivo assumiu a conversa. Checkpoint e finalização da Apresentação Digital foram cancelados e nenhuma mensagem automática será enviada por este ciclo.",
      owner_id: null,
      actor_id: "sistema",
      at,
    } as any);
  }

  await supabaseAdmin.from("relationship_engine_log").insert({
    scope: "production",
    action: "ciclo_encerrado_oportunidade",
    details: { leadId, occurrences: open.map((r) => String(r.id)), at } as any,
  } as any);

  return open.map((r) => ({ occurrenceId: String(r.id), leadId: String(r.lead_id) }));
}

/** Leads (external id) que estão hoje em etapa terminal. */
export async function terminalStageLeadIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("crm_leads")
    .select("external_id,stage_key")
    .in("stage_key", TERMINAL_STAGES as unknown as string[])
    .limit(2000);
  return new Set(
    (data ?? [])
      .map((r: any) => String(r.external_id ?? ""))
      .filter((id: string) => id.length > 0),
  );
}

/**
 * VARREDURA: encerra ciclos abertos de leads que já estavam em
 * OPORTUNIDADE. Roda junto ao tick do motor, antes do fechamento.
 */
export async function reconcileOpportunityClosures(
  nowIso?: string,
): Promise<OpportunityClosure[]> {
  const { data } = await supabaseAdmin
    .from("relationship_e20_occurrences")
    .select("id,lead_id")
    .is("closed_at", null)
    .limit(500);
  const open = (data ?? []) as any[];
  if (open.length === 0) return [];

  const terminal = await terminalStageLeadIds();
  const affected = [...new Set(open.map((r) => String(r.lead_id)))].filter((id) =>
    terminal.has(id),
  );

  const closures: OpportunityClosure[] = [];
  for (const leadId of affected) {
    closures.push(...(await closeCycleForOpportunity(leadId, nowIso)));
  }
  return closures;
}
