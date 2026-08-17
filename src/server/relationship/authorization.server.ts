/**
 * COMANDO 3G — autorização de leitura do motor no servidor.
 *
 * Usa SEMPRE o cliente autenticado do próprio usuário (RLS ativo) para
 * descobrir papel e responsabilidade. Nenhum privilégio é elevado aqui.
 */
import { canReadRelationship } from "@/lib/relationship/authorization";
import type { EngineScope } from "@/lib/relationship/types";

type UserClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
};

export async function assertRelationshipReadAccess(
  client: UserClient,
  userId: string,
  scope: EngineScope,
  leadId?: string,
): Promise<void> {
  const [admin, manager] = await Promise.all([
    client.rpc("has_role", { _user_id: userId, _role: "admin" }),
    client.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  let ownsLead = false;
  if (leadId && scope === "production") {
    const access = await client.rpc("can_access_investor", { _investor_id: leadId });
    ownsLead = access.data === true;
  }
  const allowed = canReadRelationship({
    scope,
    isAdmin: admin.data === true,
    isManager: manager.data === true,
    ownsLead,
  });
  if (!allowed) throw new Error("Acesso negado ao escopo solicitado.");
}