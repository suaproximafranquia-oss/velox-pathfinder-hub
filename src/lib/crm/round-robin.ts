/**
 * COMANDO 2 §8/§34 — FILA CIRCULAR ÚNICA DA PLATAFORMA.
 *
 * Este módulo NÃO possui ordem própria. Existe apenas uma fila oficial
 * (`@/lib/crm/redistribution`), evitando que duas listas divergentes
 * distribuam leads para Executivos diferentes. Nenhum usuário escolhe o
 * Executivo: a ordem é fixa, circular e resolvida contra os
 * colaboradores ativos.
 */
import {
  REDISTRIBUTION_ORDER,
  redistributionQueue,
  type RedistributionTarget,
} from "@/lib/crm/redistribution";

/** Mantido por compatibilidade — a fonte é a fila de redistribuição. */
export const ROUND_ROBIN_ORDER = REDISTRIBUTION_ORDER;

export type RoundRobinTarget = RedistributionTarget;

/** Fila oficial resolvida contra os usuários reais da plataforma. */
export function roundRobinQueue(): RoundRobinTarget[] {
  return redistributionQueue();
}

/** Próximo Executivo da ordem fixa, a partir do responsável atual. */
export function nextRoundRobinOwner(currentOwnerId: string): RoundRobinTarget | null {
  const queue = roundRobinQueue();
  if (queue.length === 0) return null;
  const index = queue.findIndex((t) => t.id === currentOwnerId);
  if (index < 0) return queue[0] ?? null;
  return queue[(index + 1) % queue.length] ?? null;
}
