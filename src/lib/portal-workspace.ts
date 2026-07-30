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

/**
 * Regra oficial (Prompt 7C): apenas o perfil Administrador enxerga a aba
 * "Portal". Gestores e Colaboradores operam exclusivamente no escopo
 * Green Sales, com os Leads vinculados ao seu próprio link.
 * O nome exibido nunca é utilizado — apenas o perfil técnico.
 */
export function canAccessPortalWorkspace(
  _userId: string,
  role: ExecutiveRole,
): boolean {
  return role === "super_admin";
}

export type WorkspaceScope = "green_sales" | "portal";

export const WORKSPACE_SCOPE_LABEL: Record<WorkspaceScope, string> = {
  green_sales: "Green Sales",
  portal: "Portal",
};