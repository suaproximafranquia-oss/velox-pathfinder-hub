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
  ownership_seq: number;
  ownership_key: string | null;
};

const COLUMNS =
  "id,card_id,crm_lead_id,origin,lead_name,lead_whatsapp,responsible_executive_id,entry_at,entered_entry_stage_at,reactivation,state,created_at,executed_at,executed_by,result,ownership_seq,ownership_key";

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
  /**
   * REENTRADA (RE): lead já conhecido que realizou NOVA entrada
   * comercial. Quando verdadeiro, a régua V2 abre o ciclo em RE0 —
   * nunca em E0.
   */
  reentry?: boolean;
  /**
   * Sequência de titularidade (BLOCO 2). 0 = primeira entrada
   * operacional do card (comportamento histórico). N>0 = nova entrada
   * após redistribuição REAL — a E0 anterior permanece intacta.
   */
  ownershipSeq?: number;
  ownershipKey?: string | null;
}): Promise<{ ok: boolean; created: boolean; reason?: string }> {
  const ownershipSeq = input.ownershipSeq ?? 0;
  const { data: existing } = await supabaseAdmin
    .from("workspace_e0_actions")
    .select("id,state")
    .eq("card_id", input.cardId)
    .eq("ownership_seq", ownershipSeq)
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
    ownership_seq: ownershipSeq,
    ownership_key: input.ownershipKey ?? null,
  } as never);
  if (error) return { ok: false, created: false, reason: error.message };

  /**
   * MODO MANUAL → RÉGUA V2. A ação legada fica só como histórico; quem
   * cobra a E0 (ligação 1 → 10 min → ligação 2 → mensagem para copiar)
   * é a régua, na `relationship_queue`. Idempotente; falha aqui não
   * invalida a entrada — a reconciliação do ciclo reabre.
   */
  if (ownershipSeq === 0) {
    try {
      const { openManualE0Cadence } = await import("@/server/relationship/e0-manual.server");
      await openManualE0Cadence(input.cardId, 0, { reentry: Boolean(input.reentry) });
    } catch {
      /* reconciliado no próximo ciclo/abertura da Ação do Dia */
    }
  }
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
 * EXECUTOR LEGADO DA E0 — DESATIVADO (FAIL-CLOSED).
 *
 * A E0 do fluxo operacional atual é etapa da régua V2 e vive na fila do
 * motor: ligação 1 → 10 min → ligação 2 → mensagem apenas para COPIAR.
 * Este executor NÃO envia nada: não cria `crm_messages`, não chama
 * `registerFirstContact`/`dispatchFirstContact` e não aciona a Meta.
 * Qualquer chamada é recusada — falha ou dúvida jamais vira permissão.
 *
 * A função permanece exportada apenas para compatibilidade/histórico.
 */
export async function executeE0Action(_input: {
  actionId: string;
  executedBy: string;
  executedByUserId?: string | null;
}): Promise<{ ok: boolean; state: E0ActionState; reason?: string }> {
  return {
    ok: false,
    state: "PENDENTE",
    reason:
      "E0 é executada pela Ação do Dia na régua V2 (ligação 1 → 10 min → ligação 2 → mensagem para copiar). O caminho antigo de primeiro contato está desativado.",
  };
}


/**
 * NEUTRALIZAÇÃO DA PENDÊNCIA DE E0 (correção pontual).
 *
 * Quando o PRIMEIRO CONTATO acontece pelo caminho automático do motor,
 * uma eventual ação manual de E0 ainda PENDENTE do mesmo card deixa de
 * fazer sentido: ela seria uma segunda E0. A pendência é ENCERRADA
 * (estado CANCELADA + motivo), nunca apagada — o registro permanece
 * auditável, com data e razão.
 *
 * Nada mais muda: ownership, redistribuição, modo manual, Safety Lock
 * e histórico continuam exatamente como estavam.
 */
export async function closePendingE0Actions(input: {
  cardId: string;
  reason?: string;
}): Promise<{ closed: number }> {
  if (!input.cardId) return { closed: 0 };
  const { data } = await supabaseAdmin
    .from("workspace_e0_actions")
    .select("id")
    .eq("card_id", input.cardId)
    .eq("state", "PENDENTE");
  const ids = (data ?? []).map((row) => (row as { id: string }).id);
  if (ids.length === 0) return { closed: 0 };

  await supabaseAdmin
    .from("workspace_e0_actions")
    .update({
      state: "CANCELADA",
      executed_at: new Date().toISOString(),
      result: input.reason ?? "ENCERRADA: primeiro contato já registrado pelo motor.",
    } as never)
    .in("id", ids);
  return { closed: ids.length };
}

/**
 * PROTEÇÃO DEFENSIVA DA AÇÃO DO DIA: cards cujo primeiro contato já
 * está efetivamente registrado (`msg_e0_<card>` em `crm_messages`) não
 * podem aparecer como E0 pendente, qualquer que seja o motivo pelo qual
 * a pendência tenha sobrado.
 */
export async function filterE0WithFirstContact(cardIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(cardIds.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const { data } = await supabaseAdmin
    .from("crm_messages")
    .select("investor_id,id")
    .in("investor_id", unique)
    .like("id", "msg_e0_%")
    // Registro ANULADO (teste do fluxo legado) é histórico, não primeiro contato.
    .is("voided_at", null);
  const done = new Set<string>();
  for (const row of data ?? []) {
    const investorId = (row as { investor_id?: string }).investor_id;
    if (investorId) done.add(investorId);
  }
  return done;
}
