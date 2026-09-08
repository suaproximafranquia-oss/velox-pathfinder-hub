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
import { normalizeDailyActions, type DailyAction } from "@/lib/crm/daily-actions";

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

export async function currentDailyAction(executiveId: string | null): Promise<CurrentAction> {
  let list = normalizeDailyActions(await buildDailyActions({ executiveId }));
  const first = list[0] ?? null;
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
      );
    }
  }
  return { current: list[0] ?? null, list };
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
 * Autoriza (ou rejeita) a execução de uma ação. Devolve a ação oficial
 * do servidor — nunca os dados enviados pelo navegador.
 */
export async function assertCurrentAction(input: {
  executiveId: string | null;
  actionKey: string;
}): Promise<DailyAction> {
  const { current } = await currentDailyAction(input.executiveId);
  if (!current) {
    throw new OutOfTurnError("Não há ação corrente na fila do dia.");
  }
  if (current.actionKey !== input.actionKey) {
    throw new OutOfTurnError(
      `Fora da ordem: resolva primeiro a ação corrente (${current.name}).`,
    );
  }
  return current;
}

/**
 * Mesma trava para as ações resolvidas por identificador próprio
 * (reunião, item de fila da régua V2). A ação corrente precisa apontar
 * para o mesmo investidor.
 */
export async function assertCurrentLead(input: {
  executiveId: string | null;
  leadId: string | null;
}): Promise<DailyAction> {
  const { current } = await currentDailyAction(input.executiveId);
  if (!current) throw new OutOfTurnError("Não há ação corrente na fila do dia.");
  if (!input.leadId || current.leadId !== input.leadId) {
    throw new OutOfTurnError(
      `Fora da ordem: resolva primeiro a ação corrente (${current.name}).`,
    );
  }
  return current;
}

/**
 * Item da fila da régua V2 só pode ser resolvido se for EXATAMENTE a
 * ação corrente — o identificador enviado pelo navegador é ignorado
 * quando diverge; o servidor devolve o item oficial.
 */
export async function assertCurrentQueueItem(input: {
  executiveId: string | null;
  queueItemId: string;
}): Promise<{ current: DailyAction; queueItemId: string }> {
  const { current } = await currentDailyAction(input.executiveId);
  if (!current) throw new OutOfTurnError("Não há ação corrente na fila do dia.");
  const officialId = queueItemIdOf(current);
  if (!officialId || officialId !== input.queueItemId) {
    throw new OutOfTurnError(
      `Fora da ordem: resolva primeiro a ação corrente (${current.name}).`,
    );
  }
  return { current, queueItemId: officialId };
}
