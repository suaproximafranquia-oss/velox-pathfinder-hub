/**
 * Redistribuição automática (DF 2.4.6 §6).
 *
 * Nenhum usuário escolhe o Executivo: a Gestora apenas confirma. A ordem
 * é fixa e circular.
 */
import { loadUsers } from "@/lib/executive-auth";

export const ROUND_ROBIN_ORDER = [
  "Marton",
  "Paulo",
  "Milton",
  "Carlos",
  "Talita",
  "Thiago",
] as const;

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export type RoundRobinTarget = { id: string; name: string };

/** Fila oficial resolvida contra os usuários reais da plataforma. */
export function roundRobinQueue(): RoundRobinTarget[] {
  const users = loadUsers();
  const queue: RoundRobinTarget[] = [];
  for (const label of ROUND_ROBIN_ORDER) {
    const match = users.find((u) => normalize(u.name).startsWith(normalize(label)));
    if (match) queue.push({ id: match.id, name: match.name });
  }
  return queue;
}

/** Próximo Executivo da ordem fixa, a partir do responsável atual. */
export function nextRoundRobinOwner(currentOwnerId: string): RoundRobinTarget | null {
  const queue = roundRobinQueue();
  if (queue.length === 0) return null;
  const index = queue.findIndex((t) => t.id === currentOwnerId);
  if (index < 0) return queue[0];
  return queue[(index + 1) % queue.length];
}