/**
 * PRIMEIRO CONTATO (E0) — AÇÕES DO MODO MANUAL.
 *
 * Quando o Workspace está configurado em MODO MANUAL, a E0 continua
 * sendo DECIDIDA pelo mesmo motor de entrada (nada é duplicado): o que
 * muda é que, em vez de o sistema executar sozinho, a etapa vira uma
 * AÇÃO PENDENTE de prioridade máxima na Ação do Dia, executada por um
 * executivo e registrada com autor, horário e resultado.
 *
 * IDEMPOTÊNCIA: uma única ação por card (`card_id` UNIQUE) e a própria
 * trava do motor (`msg_e0_<cardId>`) impedem segunda E0 — por sync,
 * cron, tela, retry ou troca de responsável.
 *
 * Nada aqui libera envio real: a entrega continua passando pelo mesmo
 * executor oficial e pela Global WhatsApp Safety Lock, intocada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executionMode } from "@/server/relationship/execution-mode.server";
import { recordEvent } from "@/server/crm/lead-service.server";

export type E0ActionState = "PENDENTE" | "EXECUTADA" | "CANCELADA";

export type E0ActionRow = {
  id: string;
  card_id: string;
  crm_lead_id: string | null;
  origin: string;
  lead_name: string | null;
  lead_whatsapp: string | null;
  responsible_executive_id: string | null;
  entry_at: string | null;
  entered_entry_stage_at: string | null;
  reactivation: boolean;
  state: E0ActionState;
  created_at: string;
  executed_at: string | null;
  executed_by: string | null;
  result: string | null;
};

const COLUMNS =
  "id,card_id,crm_lead_id,origin,lead_name,lead_whatsapp,responsible_executive_id,entry_at,entered_entry_stage_at,reactivation,state,created_at,executed_at,executed_by,result";

/** Cria (ou reaproveita) a ação pendente de E0 de um card. */
export async function createPendingE0Action(input: {
  cardId: string;
  crmLeadId?: string | null;
  origin?: string;
  name: string;
  whatsapp: string;
  responsibleExecutiveId?: string | null;
  entryAt?: string | null;
  enteredEntryStageAt?: string | null;
  reactivation?: boolean;
}): Promise<{ ok: boolean; created: boolean; reason?: string }> {
  const { data: existing } = await supabaseAdmin
    .from("workspace_e0_actions")
    .select("id,state")
    .eq("card_id", input.cardId)
    .maybeSingle();
  if (existing) return { ok: true, created: false };

  const { error } = await supabaseAdmin.from("workspace_e0_actions").insert({
    card_id: input.cardId,
    crm_lead_id: input.crmLeadId ?? null,
    origin: input.origin ?? "greensales",
    lead_name: input.name,
    lead_whatsapp: input.whatsapp,
    responsible_executive_id: input.responsibleExecutiveId ?? null,
    entry_at: input.entryAt ?? null,
    entered_entry_stage_at: input.enteredEntryStageAt ?? null,
    reactivation: Boolean(input.reactivation),
    state: "PENDENTE",
  } as never);
  if (error) return { ok: false, created: false, reason: error.message };
  return { ok: true, created: true };
}

/** Ações de E0 ainda pendentes — fonte da Ação do Dia. */
export async function listPendingE0Actions(executiveId?: string | null): Promise<E0ActionRow[]> {
  const { data } = await supabaseAdmin
    .from("workspace_e0_actions")
    .select(COLUMNS)
    .eq("state", "PENDENTE")
    .order("created_at", { ascending: true })
    .limit(500);
  const rows = (data ?? []) as unknown as E0ActionRow[];
  if (!executiveId) return rows;
  /** Sem responsável definido a ação continua visível — nada se perde. */
  return rows.filter(
    (row) => !row.responsible_executive_id || row.responsible_executive_id === executiveId,
  );
}

/**
 * Execução manual da E0 pelo executivo. O caminho de entrega é o MESMO
 * do modo automático (`registerFirstContact`), com a mesma trava de
 * duplicidade e a mesma Safety Lock.
 */
export async function executeE0Action(input: {
  actionId: string;
  executedBy: string;
  executedByUserId?: string | null;
}): Promise<{ ok: boolean; state: E0ActionState; reason?: string }> {
  const { data } = await supabaseAdmin
    .from("workspace_e0_actions")
    .select(COLUMNS)
    .eq("id", input.actionId)
    .maybeSingle();
  const action = data as unknown as E0ActionRow | null;
  if (!action) return { ok: false, state: "PENDENTE", reason: "Ação não encontrada." };
  if (action.state !== "PENDENTE") {
    return { ok: false, state: action.state, reason: "Esta E0 já foi encerrada." };
  }

  const { data: card } = await supabaseAdmin
    .from("portal_leads")
    .select("id,name,whatsapp,is_test")
    .eq("id", action.card_id)
    .maybeSingle();

  const mode = executionMode({ isTestLead: Boolean(card?.is_test) });
  const { registerFirstContact } = await import("@/server/crm/first-contact.server");
  const originMap: Record<string, { origin: string; entryOrigin: "GREENSALES" | "PORTAL" | "TRAFEGO_PAGO" }> = {
    greensales: { origin: "GreenSales", entryOrigin: "GREENSALES" },
    portal: { origin: "Portal do Investidor", entryOrigin: "PORTAL" },
    tiktok: { origin: "TikTok", entryOrigin: "TRAFEGO_PAGO" },
    meta: { origin: "Meta", entryOrigin: "TRAFEGO_PAGO" },
  };
  const mapped = originMap[action.origin ?? ""] ?? { origin: "GreenSales", entryOrigin: "GREENSALES" };

  const e0 = await registerFirstContact({
    leadId: action.card_id,
    name: card?.name ?? action.lead_name ?? "",
    phone: card?.whatsapp ?? action.lead_whatsapp ?? "",
    origin: mapped.origin,
    entryOrigin: mapped.entryOrigin,
    ownerId: null,
    entryAt: action.entry_at,
    enteredEntryStageAt: action.entered_entry_stage_at,
    reactivation: Boolean(action.reactivation),
    simulated: mode.simulated,
  });

  const executedAt = new Date().toISOString();
  const result = e0.registered
    ? mode.simulated
      ? "EXECUTADA_SIMULADA"
      : "EXECUTADA"
    : `BLOQUEADA: ${e0.reason ?? "sem motivo informado"}`;

  if (!e0.registered) {
    await supabaseAdmin
      .from("workspace_e0_actions")
      .update({ result } as never)
      .eq("id", action.id);
    if (action.crm_lead_id) {
      await recordEvent(action.crm_lead_id, "e0_manual_bloqueada", e0.reason ?? result);
    }
    return { ok: false, state: "PENDENTE", reason: e0.reason ?? "E0 não pôde ser executada." };
  }

  await supabaseAdmin
    .from("workspace_e0_actions")
    .update({
      state: "EXECUTADA",
      executed_at: executedAt,
      executed_by: input.executedBy,
      executed_by_user_id: input.executedByUserId ?? null,
      result,
    } as never)
    .eq("id", action.id);

  if (action.crm_lead_id) {
    await recordEvent(
      action.crm_lead_id,
      mode.simulated ? "e0_manual_simulada" : "e0_manual_executada",
      `Primeiro contato executado manualmente por ${input.executedBy} no card ${action.card_id}.`,
    );
  }

  return { ok: true, state: "EXECUTADA" };
}
