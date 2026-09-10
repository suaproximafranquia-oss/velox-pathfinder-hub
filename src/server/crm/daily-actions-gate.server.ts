/**
 * TRAVA SEQUENCIAL DA AÇÃO DO DIA — AUTORIDADE DO SERVIDOR.
 *
 * A ordem da fila NÃO é decoração de tela. O executivo resolve a ação
 * corrente ou usa o Pular permitido; ele não escolhe o investidor.
 *
 * Como funciona:
 *   • a lista oficial é RECALCULADA no servidor a cada tentativa;
 *   • a ação corrente é sempre a primeira da lista normalizada;
 *   • concluir ou pular qualquer outra ação é REJEITADO aqui, antes de
 *     qualquer escrita — esconder botão na interface não é trava;
 *   • duas abas abertas veem a mesma verdade: quem chega depois recebe
 *     a lista já recalculada e não consegue furar a ordem.
 *
 * POSIÇÃO 1 PROTEGIDA: quando a ação corrente é um item da fila da
 * régua V2, ela é REIVINDICADA no banco (`relationship_queue.status =
 * PROCESSING`, `claimed_by`). Novas liberações (ex.: 2ª ligação E0 de
 * outro investidor) entram DEPOIS dela — a ação em atendimento não
 * perde a posição. Não existe outra fila: é a mesma tabela do motor.
 *
 * Dentro do MESMO investidor a sequência também é do servidor: a
 * ligação vem antes da mensagem (precedência de fonte) e, ao pular a
 * ligação, a próxima ação liberada é a do mesmo investidor — nunca o
 * próximo da fila.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildDailyActions } from "@/server/crm/daily-actions.server";
import { normalizeDailyActions, isAutomaticDailyAction, type DailyAction } from "@/lib/crm/daily-actions";

export class OutOfTurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutOfTurnError";
  }
}

export type CurrentAction = { current: DailyAction | null; list: DailyAction[] };

/** Identificador do item da fila embutido na chave `queue:<lead>:<fluxo>-<etapa>:<id>`. */
export function queueItemIdOf(action: DailyAction | null | undefined): string | null {
  if (!action || !action.actionKey.startsWith("queue:")) return null;
  const id = action.actionKey.split(":").pop() ?? "";
  return id.length > 0 ? id : null;
}

/** Janela em que a próxima ação do MESMO lead ainda é continuidade. */
const CONTINUITY_WINDOW_MS = 20 * 60 * 1000;

/**
 * CONTINUIDADE DA CADEIA — DECIDIDA PELO SERVIDOR.
 *
 * Uma ligação sem atendimento só mantém o lead em curso quando o motor
 * já criou uma próxima ação pendente da MESMA etapa. A decisão usa o
 * resultado e a fila reais; não presume continuidade pelo nome da etapa.
 *
 * Lê a MESMA fila do motor: nenhuma segunda fila, nenhum `due_at`
 * alterado e nenhum item marcado artificialmente como atrasado.
 *
 * O status de conclusão da fila é `EXECUTED` (vocabulário oficial de
 * `QueueStatus`).
 */
async function recentContinuityLead(executiveId: string | null): Promise<string | null> {
  if (!executiveId) return null;
  const since = new Date(Date.now() - CONTINUITY_WINDOW_MS).toISOString();
  try {
    const { data } = await supabaseAdmin
      .from("relationship_queue")
      .select("lead_id,executed_at,step,scope,action_order,result,action_kind")
      .eq("claimed_by", executiveId)
      .eq("status", "EXECUTED")
      .gte("executed_at", since)
      .order("executed_at", { ascending: false })
      .limit(1);
    const last = (data ?? [])[0] as {
      lead_id?: string;
      step?: string;
      scope?: string;
      action_order?: number;
      result?: string;
      action_kind?: string;
    } | undefined;
    if (
      !last?.lead_id ||
      last.result !== "NAO" ||
      last.action_kind !== "call" ||
      !last.step ||
      !last.scope
    ) return null;

    const { data: next } = await supabaseAdmin
      .from("relationship_queue")
      .select("id")
      .eq("scope", last.scope)
      .eq("lead_id", last.lead_id)
      .eq("step", last.step)
      .in("status", ["PENDING", "PROCESSING"])
      .gt("action_order", Number(last.action_order ?? 0))
      .limit(1);
    return (next ?? []).length > 0 ? last.lead_id : null;
  } catch {
    return null;
  }
}

export async function currentDailyAction(
  executiveId: string | null,
  options: { skipReconcile?: boolean } = {},
): Promise<CurrentAction> {
  const continuityLeadId = await recentContinuityLead(executiveId);
  let list = normalizeDailyActions(
    await buildDailyActions({ executiveId, skipReconcile: options.skipReconcile === true }),
    continuityLeadId,
  );
  const first = list.find(isAutomaticDailyAction) ?? null;

  const queueItemId = queueItemIdOf(first);

  if (first && queueItemId && !first.claimed) {
    /**
     * Reivindicação atômica: só PENDING vira PROCESSING. Duas abas que
     * chegam juntas reivindicam a MESMA linha uma única vez.
     */
    const nowIso = new Date().toISOString();
    const { data } = await supabaseAdmin
      .from("relationship_queue")
      .update({
        status: "PROCESSING",
        claimed_by: executiveId,
        claimed_at: nowIso,
        updated_at: nowIso,
      } as never)
      .eq("id", queueItemId)
      .eq("status", "PENDING")
      .select("id");
    if (data && data.length > 0) {
      list = normalizeDailyActions(
        list.map((item) => (item.actionKey === first.actionKey ? { ...item, claimed: true } : item)),
        continuityLeadId,
      );
    }
  }
  return { current: list.find(isAutomaticDailyAction) ?? null, list };
}

/** Libera a reivindicação (PROCESSING → PENDING) — usado ao pular. */
export async function releaseQueueClaim(queueItemId: string | null): Promise<void> {
  if (!queueItemId) return;
  await supabaseAdmin
    .from("relationship_queue")
    .update({ status: "PENDING", claimed_by: null, claimed_at: null, updated_at: new Date().toISOString() } as never)
    .eq("id", queueItemId)
    .eq("status", "PROCESSING");
}

/**
 * EXCEÇÃO ÚNICA DA TRAVA — PENDÊNCIA PULADA DO PRÓPRIO EXECUTIVO.
 *
 * A ordem do dia continua intocada: esta exceção só alcança uma ação
 * que JÁ foi pulada por este Executivo e ainda está em aberto (a mesma
 * `actionKey` registrada no histórico). Nenhuma obrigação nova é criada
 * e a posição 1 da Ação do Dia não muda.
 */
export async function findPendingRecoveryAction(input: {
  executiveId: string | null;
  match: (action: DailyAction) => boolean;
}): Promise<DailyAction | null> {
  const { listSkippedPendings } = await import("@/server/crm/daily-actions-log.server");
  const pendings = await listSkippedPendings({ executiveId: input.executiveId });
  if (pendings.length === 0) return null;
  const keys = new Set(pendings.map((p) => p.actionKey));
  const list = normalizeDailyActions(await buildDailyActions({ executiveId: input.executiveId }));
  return list.find((action) => keys.has(action.actionKey) && input.match(action)) ?? null;
}

/**
 * Autoriza (ou rejeita) a execução de uma ação. Devolve a ação oficial
 * do servidor — nunca os dados enviados pelo navegador.
 */
export async function assertCurrentAction(input: {
  executiveId: string | null;
  actionKey: string;
  /** Resolução de pendência pulada, aberta pela Central de Operações. */
  allowPendingRecovery?: boolean;
}): Promise<DailyAction> {
  const { current } = await currentDailyAction(input.executiveId);
  if (current && current.actionKey === input.actionKey) return current;
  if (input.allowPendingRecovery) {
    const pending = await findPendingRecoveryAction({
      executiveId: input.executiveId,
      match: (action) => action.actionKey === input.actionKey,
    });
    if (pending) return pending;
  }
  if (!current) {
    throw new OutOfTurnError("Não há ação corrente na fila do dia.");
  }
  throw new OutOfTurnError(
    `Fora da ordem: resolva primeiro a ação corrente (${current.name}).`,
  );
}

/**
 * Mesma trava para as ações resolvidas por identificador próprio
 * (reunião, item de fila da régua V2). A ação corrente precisa apontar
 * para o mesmo investidor.
 */
export async function assertCurrentLead(input: {
  executiveId: string | null;
  leadId: string | null;
  allowPendingRecovery?: boolean;
}): Promise<DailyAction> {
  const { current } = await currentDailyAction(input.executiveId);
  if (current && input.leadId && current.leadId === input.leadId) return current;
  if (input.allowPendingRecovery && input.leadId) {
    const pending = await findPendingRecoveryAction({
      executiveId: input.executiveId,
      match: (action) => action.leadId === input.leadId,
    });
    if (pending) return pending;
  }
  if (!current) throw new OutOfTurnError("Não há ação corrente na fila do dia.");
  throw new OutOfTurnError(
    `Fora da ordem: resolva primeiro a ação corrente (${current.name}).`,
  );
}

/**
 * Item da fila da régua V2 só pode ser resolvido se for EXATAMENTE a
 * ação corrente — o identificador enviado pelo navegador é ignorado
 * quando diverge; o servidor devolve o item oficial.
 */
export async function assertCurrentQueueItem(input: {
  executiveId: string | null;
  queueItemId: string;
  allowPendingRecovery?: boolean;
}): Promise<{ current: DailyAction; queueItemId: string }> {
  const { current } = await currentDailyAction(input.executiveId);
  const officialId = queueItemIdOf(current);
  if (current && officialId && officialId === input.queueItemId) {
    return { current, queueItemId: officialId };
  }
  if (input.allowPendingRecovery) {
    const pending = await findPendingRecoveryAction({
      executiveId: input.executiveId,
      match: (action) => queueItemIdOf(action) === input.queueItemId,
    });
    const pendingId = queueItemIdOf(pending);
    if (pending && pendingId) return { current: pending, queueItemId: pendingId };
  }
  if (!current) throw new OutOfTurnError("Não há ação corrente na fila do dia.");
  throw new OutOfTurnError(
    `Fora da ordem: resolva primeiro a ação corrente (${current.name}).`,
  );
}

/** Desfecho de compromisso aberto: exceção restrita, não autoriza ações da cadência. */
export async function assertCommitmentAction(input: {
  executiveId: string | null;
  actionKey: string;
  meetingId: string;
  allowPendingRecovery?: boolean;
}): Promise<DailyAction> {
  if (!input.executiveId) throw new OutOfTurnError("Executivo não identificado.");
  const list = await buildDailyActions({ executiveId: input.executiveId, skipReconcile: true });
  const action = list.find((a) => a.actionKey === input.actionKey && a.source === "meeting" && a.meetingId === input.meetingId);
  if (action?.bucket === "pendente") return action;
  const current = await assertCurrentAction(input);
  if (current.source !== "meeting" || current.meetingId !== input.meetingId) {
    throw new OutOfTurnError("Compromisso não corresponde à ação autorizada.");
  }
  return current;
}
