/**
 * DESFECHO DA LIGAÇÃO DA RÉGUA V2 — SERVER ONLY (Financeira /f).
 *
 * A ligação nasce como AÇÃO INTERNA da etapa, na própria fila do motor.
 * Aqui apenas registramos o desfecho e aplicamos a regra fechada com a
 * gestão:
 *
 *   ATENDEU = SIM → as ações restantes DAQUELA ETAPA perdem a finalidade
 *   e são CANCELADAS (inclusive a mensagem da tentativa). A cadência
 *   CONTINUA: a próxima etapa da régua é gerada normalmente. Atender não
 *   é compromisso — só AGENDAMENTOS/VÍDEO com `follow_up` congela.
 *
 *   ATENDEU = NÃO → a ação é concluída e o motor segue a régua normalmente.
 *
 * Nada é apagado e nenhuma mensagem é enviada por aqui.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Engine } from "@/lib/relationship/engine";

export type QueueCallOutcome = "SIM" | "NAO";

export async function registerQueueCallOutcome(input: {
  queueItemId: string;
  outcome: QueueCallOutcome;
  /** Quantas vezes chamou, quando não atendeu (histórico operacional). */
  rang?: number | boolean | null;
  actorId: string;
  nowIso?: string;
  /** Motor da rodada isolada; ausente mantém exatamente o caminho produtivo. */
  engine?: Engine;
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
    /**
     * Não atendeu: a próxima ação da MESMA etapa (2ª ligação em +10 min,
     * depois a mensagem para copiar) é programada pelo motor AGORA, para
     * não depender do próximo ciclo do agendador. Falha aqui não desfaz
     * o desfecho — o tique regular reprograma.
     */
    await tickLead(row.lead_id, input.engine);
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


  /**
   * ATENDER NÃO CONGELA. A cadência segue a régua normalmente: só um
   * compromisso real (AGENDAMENTOS/VÍDEO com `follow_up`) congela.
   * Por isso nada é gravado em `awaiting_handoff` aqui — o campo fica
   * apenas como histórico dos ciclos anteriores.
   */
  await tickLead(row.lead_id, input.engine);

  // E0 atendida: a pendência legada de E0 (se existir) deixa de fazer sentido.
  if (row.step === "E0") await closeLegacyE0(row.lead_id, "ENCERRADA: E0 atendida pela régua V2 (Ação do Dia).");

  return { concluded: true, awaitingHandoff: false };
}

async function tickLead(leadId: string, supplied?: Engine): Promise<void> {
  try {
    if (supplied) {
      await supplied.tick(leadId);
      return;
    }
    const { productionEngine } = await import("./engine.server");
    await productionEngine().tick(leadId);
  } catch {
    /* o agendador regular reprograma */
  }
}

/** Pendência legada de E0 — só histórico/compatibilidade; encerrada sem apagar. */
export async function closeLegacyE0(leadId: string, reason: string): Promise<void> {
  try {
    const { closePendingE0Actions } = await import("@/server/crm/e0-actions.server");
    await closePendingE0Actions({ cardId: leadId, reason });
  } catch {
    /* compatibilidade: nunca invalida a régua */
  }
}

/**
 * DESFAZER O RESULTADO DA LIGAÇÃO — reversível apenas enquanto não houve
 * outra ação irreversível do investidor depois dela. Nada é apagado:
 * a linha volta a PENDENTE, a ação programada em consequência é
 * neutralizada (`undo_call_outcome`), o cancelamento por atendimento é
 * revertido e a espera por encaminhamento é limpa. Fica registrado.
 */
export async function undoQueueCallOutcome(input: {
  queueItemId: string;
  actorId: string;
  nowIso?: string;
}): Promise<{ undone: boolean; reason: string | null }> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const { data: item } = await supabaseAdmin
    .from("relationship_queue")
    .select("id,lead_id,step,scope,status,action_kind,action_order,result,executed_at")
    .eq("id", input.queueItemId)
    .maybeSingle();
  const row = item as Record<string, any> | null;
  if (!row) return { undone: false, reason: "Ação não encontrada." };
  if (row.action_kind !== "call" || row.status !== "EXECUTED" || !row.result) {
    return { undone: false, reason: "Só o resultado de uma ligação já registrada pode ser desfeito." };
  }

  // Outra ação do investidor executada DEPOIS torna o resultado irreversível.
  const { data: later } = await supabaseAdmin
    .from("relationship_queue")
    .select("id")
    .eq("scope", row.scope)
    .eq("lead_id", row.lead_id)
    .eq("status", "EXECUTED")
    .gt("executed_at", row.executed_at)
    .limit(1);
  if ((later ?? []).length > 0) {
    return { undone: false, reason: "Já existe uma ação posterior concluída — o resultado não pode mais ser desfeito." };
  }

  const { data: reverted } = await supabaseAdmin
    .from("relationship_queue")
    .update({ status: "PENDING", executed_at: null, result: null, updated_at: nowIso } as never)
    .eq("id", row.id)
    .eq("status", "EXECUTED")
    .select("id");
  if (!reverted || reverted.length === 0) return { undone: false, reason: "Resultado já foi desfeito." };

  if (row.result === "NAO") {
    // A ação programada em consequência (ex.: 2ª ligação) é neutralizada.
    await supabaseAdmin
      .from("relationship_queue")
      .update({
        status: "CANCELLED",
        cancel_reason: "undo_call_outcome",
        reason: "Resultado da ligação anterior desfeito pelo executivo.",
        updated_at: nowIso,
      } as never)
      .eq("scope", row.scope)
      .eq("lead_id", row.lead_id)
      .eq("step", row.step)
      .gt("action_order", row.action_order ?? 1)
      .in("status", ["PENDING", "PROCESSING"]);
  } else {
    await supabaseAdmin
      .from("relationship_queue")
      .update({ status: "PENDING", cancel_reason: null, reason: "Cancelamento revertido — resultado desfeito.", updated_at: nowIso } as never)
      .eq("scope", row.scope)
      .eq("lead_id", row.lead_id)
      .eq("step", row.step)
      .eq("status", "CANCELLED")
      .eq("cancel_reason", "contact_attended");
    await supabaseAdmin
      .from("relationship_cadences")
      .update({ awaiting_handoff: false, awaiting_handoff_reason: null, updated_at: nowIso } as never)
      .eq("scope", row.scope)
      .eq("lead_id", row.lead_id)
      .eq("awaiting_handoff", true);
  }

  try {
    await supabaseAdmin.from("crm_lead_events").insert({
      lead_id: row.lead_id,
      type: "CADENCE_CALL_OUTCOME_UNDONE",
      message: `Resultado da ligação da etapa ${row.step} (${row.result}) desfeito pelo executivo.`,
      data: { step: row.step, previousOutcome: row.result, queueItemId: row.id, actorId: input.actorId },
    } as never);
  } catch {
    /* histórico complementar */
  }
  return { undone: true, reason: null };
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
