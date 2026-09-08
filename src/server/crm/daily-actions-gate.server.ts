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
 * Dentro do MESMO investidor a sequência também é do servidor: a
 * ligação vem antes da mensagem (precedência de fonte) e, ao pular a
 * ligação, a próxima ação liberada é a do mesmo investidor — nunca o
 * próximo da fila.
 */
import { buildDailyActions } from "@/server/crm/daily-actions.server";
import { normalizeDailyActions, type DailyAction } from "@/lib/crm/daily-actions";

export class OutOfTurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutOfTurnError";
  }
}

export type CurrentAction = { current: DailyAction | null; list: DailyAction[] };

export async function currentDailyAction(executiveId: string | null): Promise<CurrentAction> {
  const list = normalizeDailyActions(await buildDailyActions({ executiveId }));
  return { current: list[0] ?? null, list };
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
