/**
 * Autorização técnica do Workspace Portal.
 *
 * A disponibilidade da aba "Portal" (Leads originados diretamente pelo
 * Portal Velox) é controlada por um identificador técnico permanente do
 * colaborador — nunca pelo nome exibido. Isso garante que renomear o
 * usuário jamais quebre a regra de permissão.
 *
 * A lista abaixo pode evoluir para configuração dinâmica (Administrador)
 * sem impacto nas telas que consomem `canAccessPortalWorkspace`.
 */
import type { ExecutiveRole } from "@/lib/executive-auth";

/** IDs técnicos autorizados a visualizar o Workspace Portal. */
const AUTHORIZED_USER_IDS = new Set<string>([
  "usr_thiago", // Thiago Rodrigues — Administrador Geral
]);

/**
 * Regra oficial: administradores sempre têm acesso; demais colaboradores
 * precisam constar da lista técnica. Nome exibido nunca é utilizado.
 */
export function canAccessPortalWorkspace(
  userId: string,
  role: ExecutiveRole,
): boolean {
  if (role === "super_admin") return true;
  return AUTHORIZED_USER_IDS.has(userId);
}

export type WorkspaceScope = "green_sales" | "portal";

export const WORKSPACE_SCOPE_LABEL: Record<WorkspaceScope, string> = {
  green_sales: "Green Sales",
  portal: "Portal",
};