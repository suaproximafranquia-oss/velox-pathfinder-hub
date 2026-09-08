/**
 * DESFECHO DA LIGAÇÃO DA RÉGUA V2 — SERVER ONLY (Financeira /f).
 *
 * A ligação nasce como AÇÃO INTERNA da etapa, na própria fila do motor.
 * Aqui apenas registramos o desfecho e aplicamos a regra fechada com a
 * gestão:
 *
 *   ATENDEU = SIM → as ações restantes daquela etapa perdem a finalidade
 *   e são CANCELADAS (inclusive a mensagem da tentativa). A cadência NÃO
 *   avança sozinha: o ciclo passa a AGUARDAR ENCAMINHAMENTO (agendamento,
 *   mudança de estágio ou material efetivamente enviado).
 *
 *   ATENDEU = NÃO → a ação é concluída e o motor segue a régua normalmente.
 *
 * Nada é apagado e nenhuma mensagem é enviada por aqui.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type QueueCallOutcome = "SIM" | "NAO";

export async function registerQueueCallOutcome(input: {
  queueItemId: string;
  outcome: QueueCallOutcome;
  /** Quantas vezes chamou, quando não atendeu (histórico operacional). */
  rang?: number | boolean | null;
  actorId: string;
  nowIso?: string;
}): Promise<{ concluded: boolean; awaitingHandoff: boolean }> {
  const nowIso = input.nowIso ?? new Date().toISOString();

  const { data: item } = await supabaseAdmin
    .from("relationship_queue")
    .select("id,lead_id,step,scope,status,action_kind")
    .eq("id", input.queueItemId)
    .maybeSingle();
  if (!item) return { concluded: false, awaitingHandoff: false };

  const row = item as Record<string, any>;
  if (row.status === "EXECUTED" || row.status === "CANCELLED") {
    return { concluded: false, awaitingHandoff: false };
  }

  /**
   * CONCORRÊNCIA: a escrita só acontece se a linha AINDA estiver
   * pendente. Duas abas, dois cliques ou duas requisições simultâneas
   * resolvem a mesma ação uma única vez — a segunda não altera nada.
   */
  const { data: claimed } = await supabaseAdmin
    .from("relationship_queue")
    .update({
      status: "EXECUTED",
      executed_at: nowIso,
      result: input.outcome,
      updated_at: nowIso,
    } as never)
    .eq("id", input.queueItemId)
    .in("status", ["PENDING", "PROCESSING"])
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { concluded: false, awaitingHandoff: false };
  }


  await supabaseAdmin.from("crm_lead_events").insert({
    lead_id: row.lead_id,
    type: "CADENCE_CALL_OUTCOME",
    message:
      input.outcome === "SIM"
        ? `Ligação da etapa ${row.step} — investidor atendeu.`
        : `Ligação da etapa ${row.step} — investidor não atendeu.`,
    data: {
      step: row.step,
      outcome: input.outcome,
      rang: input.outcome === "NAO" ? (input.rang ?? null) : null,
      queueItemId: input.queueItemId,
      actorId: input.actorId,
    },
  } as never);

  if (input.outcome !== "SIM") {
    // Não atendeu: o motor continua a régua no próximo tique.
    return { concluded: true, awaitingHandoff: false };
  }

  // Atendeu: as ações seguintes DA MESMA ETAPA perderam a finalidade.
  // As obrigações das demais etapas do lead permanecem intactas.
  await supabaseAdmin
    .from("relationship_queue")
    .update({
      status: "CANCELLED",
      cancel_reason: "contact_attended",
      reason: "Ligação atendida — ação sem finalidade.",
      updated_at: nowIso,
    } as never)
    .eq("scope", row.scope)
    .eq("lead_id", row.lead_id)
    .eq("step", row.step)
    .in("status", ["PENDING", "PROCESSING"]);


  await supabaseAdmin
    .from("relationship_cadences")
    .update({
      awaiting_handoff: true,
      awaiting_handoff_since: nowIso,
      awaiting_handoff_reason: "Ligação atendida — aguardando encaminhamento do Executivo.",
      updated_at: nowIso,
    } as never)
    .eq("scope", row.scope)
    .eq("lead_id", row.lead_id);

  return { concluded: true, awaitingHandoff: true };
}

/**
 * ENCAMINHAMENTO REGISTRADO — o ciclo volta a andar. Chamado quando
 * existe agendamento, mudança de estágio ou material efetivamente
 * enviado. Sem encaminhamento, a espera permanece.
 */
export async function clearAwaitingHandoff(input: {
  leadId: string;
  scope?: string;
}): Promise<void> {
  await supabaseAdmin
    .from("relationship_cadences")
    .update({
      awaiting_handoff: false,
      awaiting_handoff_reason: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("scope", input.scope ?? "production")
    .eq("lead_id", input.leadId)
    .eq("awaiting_handoff", true);
}
