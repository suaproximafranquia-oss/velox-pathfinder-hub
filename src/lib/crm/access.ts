/**
 * CRM de Relacionamento — camada de acesso (fundação).
 *
 * Reutiliza integralmente a autenticação e os perfis já existentes
 * (`src/lib/executive-auth.ts`). Nenhum novo sistema de usuários é
 * criado. Nesta etapa apenas preparamos os pontos de checagem: cada
 * Executivo enxerga exclusivamente os próprios relacionamentos.
 */
import type { ExecutiveSession } from "@/lib/executive-auth";
import type { CrmActor, CrmRelationship } from "@/lib/crm/types";

export function actorFromSession(session: ExecutiveSession): CrmActor {
  return {
    userId: session.userId,
    workspaceId: session.workspaceId,
    role: session.activeRole,
  };
}

/** Um relacionamento é visível apenas ao seu Executivo proprietário. */
export function ownsRelationship(
  actor: CrmActor,
  record: Pick<CrmRelationship, "ownerId" | "workspaceId">,
): boolean {
  return record.workspaceId === actor.workspaceId && record.ownerId === actor.userId;
}

/** Filtro padrão de leitura — ponto único para futuras consultas. */
export function scopeToActor<T extends Pick<CrmRelationship, "ownerId" | "workspaceId">>(
  actor: CrmActor,
  records: T[],
): T[] {
  return records.filter((r) => ownsRelationship(actor, r));
}

/** Cláusula de escopo destinada às consultas futuras no banco. */
export function ownerScopeFilter(actor: CrmActor) {
  return { workspace_id: actor.workspaceId, owner_id: actor.userId } as const;
}