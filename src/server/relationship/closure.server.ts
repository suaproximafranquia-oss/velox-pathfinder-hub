/**
 * FECHAMENTO DO CICLO — E27 (checkpoint) e FINALIZAÇÃO — SERVER ONLY.
 *
 * A E20 ("E6 — Apresentação Digital") já gravava as duas datas do
 * fechamento (`checkpoint_due_at` e `finalization_due_on`) sem que nada
 * as consumisse. Este módulo é o EXECUTOR que faltava.
 *
 * REGRAS FECHADAS:
 *  • Nada de texto inventado: o corpo vem da versão ATIVA da Biblioteca.
 *    Sem texto oficial publicado, a etapa NÃO é executada e o motivo
 *    fica auditável — a obrigação permanece pendente.
 *  • Identidade real: quem assina é o EXECUTIVO RESPONSÁVEL pelo lead.
 *  • Ambiente antes de credencial: em simulação (ou lead de teste) a
 *    Meta nunca é chamada; a etapa é registrada como simulada.
 *  • Idempotência por OCORRÊNCIA: o id da mensagem é determinístico
 *    (`msg_<etapa>_<ocorrência>`), então uma segunda passada do cron
 *    nunca duplica o envio, e um segundo ciclo de E20 tem fechamento
 *    próprio.
 *  • Uma ocorrência encerrada (OPORTUNIDADE, substituição) não gera
 *    fechamento.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderFromLibrary, recordMessageSnapshot } from "./message-library.server";
import { executionMode, SIMULATION_LABEL } from "./execution-mode.server";
import { resolveLeadExecutive } from "./executive-identity.server";
import { resolveRecipientPhone } from "./guard.server";
import { sendWhatsappText } from "@/server/crm/messaging.server";
import { operationalDate } from "@/lib/crm/daily-actions";

export const CHECKPOINT_STEP = "E27";
export const FINALIZATION_STEP = "FINALIZACAO";

export type ClosureKind = "checkpoint" | "finalizacao";

export type ClosureDuty = {
  occurrenceId: string;
  leadId: string;
  instanceSeq: number;
  kind: ClosureKind;
  step: string;
  /** Instante/dia em que a obrigação venceu. */
  dueAt: string;
  dueDate: string;
  linkUrl: string;
};

export type ClosureOutcome = {
  duty: ClosureDuty;
  executed: boolean;
  simulated: boolean;
  reason: string | null;
};

/**
 * Obrigações de fechamento VENCIDAS. Leitura pura — usada tanto pelo
 * executor quanto pela Ação do Dia, para que as duas enxerguem
 * exatamente a mesma lista.
 */
export async function listClosureDuties(nowIso?: string): Promise<ClosureDuty[]> {
  const at = nowIso ?? new Date().toISOString();
  const today = operationalDate(at);

  const { data } = await supabaseAdmin
    .from("relationship_e20_occurrences")
    .select(
      "id,lead_id,instance_seq,link_url,checkpoint_due_at,checkpoint_done_at,finalization_due_on,finalization_done_at,closed_at",
    )
    .is("closed_at", null)
    .limit(500);

  const duties: ClosureDuty[] = [];
  for (const row of (data ?? []) as any[]) {
    const checkpointDue = row.checkpoint_due_at ? String(row.checkpoint_due_at) : null;
    if (checkpointDue && !row.checkpoint_done_at && new Date(checkpointDue).getTime() <= new Date(at).getTime()) {
      duties.push({
        occurrenceId: String(row.id),
        leadId: String(row.lead_id),
        instanceSeq: Number(row.instance_seq ?? 1),
        kind: "checkpoint",
        step: CHECKPOINT_STEP,
        dueAt: checkpointDue,
        dueDate: operationalDate(checkpointDue),
        linkUrl: String(row.link_url ?? ""),
      });
    }

    const finalizationDue = row.finalization_due_on ? String(row.finalization_due_on) : null;
    if (finalizationDue && !row.finalization_done_at && finalizationDue <= today) {
      duties.push({
        occurrenceId: String(row.id),
        leadId: String(row.lead_id),
        instanceSeq: Number(row.instance_seq ?? 1),
        kind: "finalizacao",
        step: FINALIZATION_STEP,
        dueAt: `${finalizationDue}T12:00:00.000Z`,
        dueDate: finalizationDue,
        linkUrl: String(row.link_url ?? ""),
      });
    }
  }
  return duties;
}

async function log(action: string, details: Record<string, unknown>): Promise<void> {
  await supabaseAdmin.from("relationship_engine_log").insert({
    scope: "production",
    action,
    details: details as any,
  } as any);
}

/** Executa UMA obrigação de fechamento. */
export async function executeClosureDuty(duty: ClosureDuty): Promise<ClosureOutcome> {
  const phone = await resolveRecipientPhone(duty.leadId);
  if (!phone) {
    const reason = "Destinatário sem telefone real — fechamento não enviado.";
    await log("fechamento_bloqueado", { ...duty, motivo: reason });
    return { duty, executed: false, simulated: false, reason };
  }

  const executive = await resolveLeadExecutive(duty.leadId);
  if (!executive.available) {
    await log("fechamento_bloqueado", { ...duty, motivo: executive.reason });
    return { duty, executed: false, simulated: false, reason: executive.reason };
  }

  const { data: lead } = await supabaseAdmin
    .from("portal_leads")
    .select("name,is_test")
    .eq("id", duty.leadId)
    .maybeSingle();

  const { result, message: libraryMessage } = await renderFromLibrary(duty.step, {
    executiveName: executive.name,
    portalLink: duty.linkUrl,
    rawInvestorName: lead?.name ?? null,
  });
  if (!result.ok) {
    await log("fechamento_sem_texto", { ...duty, motivo: result.reason });
    return { duty, executed: false, simulated: false, reason: result.reason };
  }

  const simulated = executionMode({ isTestLead: Boolean(lead?.is_test) }).simulated;
  const body = result.button ? `${result.body}\n\n${result.button.url}` : result.body;
  const messageId = `msg_${duty.step.toLowerCase()}_${duty.occurrenceId}`;
  const at = new Date().toISOString();

  const { error: insertError } = await supabaseAdmin.from("crm_messages").insert({
    id: messageId,
    investor_id: duty.leadId,
    direction: "enviada",
    body,
    author_id: "sistema",
    author_name: "Motor de Relacionamento",
    at,
    simulated,
  } as any);
  if (insertError && insertError.code !== "23505") {
    return { duty, executed: false, simulated, reason: insertError.message };
  }

  if (!insertError) {
    await recordMessageSnapshot({
      leadId: duty.leadId,
      step: duty.step,
      renderedBody: body,
      templateBody: libraryMessage?.body ?? body,
      libraryId: libraryMessage?.id ?? null,
      libraryVersion: libraryMessage?.version ?? null,
      libraryCode: libraryMessage?.code ?? null,
      investorNameUsed: result.treatment,
      actorName: "Motor de Relacionamento",
      origin: "motor",
      messageId,
      instanceSeq: duty.instanceSeq,
      occurrenceId: duty.occurrenceId,
      simulated,
      sentAt: at,
    });

    const delivery = simulated
      ? { delivered: false as const, error: undefined as string | undefined }
      : await sendWhatsappText({ phone, body });

    await supabaseAdmin.from("crm_timeline").insert({
      id: `tl_${duty.step.toLowerCase()}_${duty.occurrenceId}`,
      investor_id: duty.leadId,
      event: `fechamento_${duty.kind}`,
      origin: "motor_relacionamento",
      reason: simulated
        ? `${SIMULATION_LABEL} — ${duty.step} registrada sem entrega real.`
        : delivery.delivered
          ? `${duty.step} enviada pelo canal oficial.`
          : `${duty.step} registrada. Entrega externa pendente: ${delivery.error ?? "canal indisponível"}.`,
      owner_id: null,
      actor_id: "sistema",
      at,
    } as any);
  }

  const patch =
    duty.kind === "checkpoint"
      ? { checkpoint_done_at: at }
      : { finalization_done_at: at, status: "finalizada", closed_at: at, close_reason: "ciclo_finalizado" };
  await supabaseAdmin
    .from("relationship_e20_occurrences")
    .update(patch as any)
    .eq("id", duty.occurrenceId);

  await log(simulated ? "fechamento_simulado" : "fechamento_executado", { ...duty });
  return { duty, executed: true, simulated, reason: null };
}

/** Passada completa: executa todas as obrigações vencidas. */
export async function runClosureTick(nowIso?: string): Promise<ClosureOutcome[]> {
  const duties = await listClosureDuties(nowIso);
  const outcomes: ClosureOutcome[] = [];
  for (const duty of duties) {
    outcomes.push(await executeClosureDuty(duty));
  }
  return outcomes;
}
