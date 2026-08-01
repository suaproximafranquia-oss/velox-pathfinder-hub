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
 * Identificadores técnicos com perfil híbrido (DEF 2.4.16 §10 / 2.4.17 §6):
 * enxergam GreenSales e Portal em QUALQUER perfil ativo. O nome exibido
 * jamais é utilizado — apenas o identificador técnico permanente.
 */
export const HYBRID_WORKSPACE_USER_IDS: readonly string[] = ["usr_thiago"];

export function isHybridWorkspaceUser(userId: string): boolean {
  return HYBRID_WORKSPACE_USER_IDS.includes(userId);
}

/**
 * Regra oficial: o Administrador enxerga a aba "Portal"; os perfis
 * híbridos também, independentemente do perfil ativo. Os demais
 * Colaboradores operam exclusivamente no escopo Green Sales.
 */
export function canAccessPortalWorkspace(
  userId: string,
  role: ExecutiveRole,
): boolean {
  return role === "super_admin" || isHybridWorkspaceUser(userId);
}

export type WorkspaceScope = "green_sales" | "portal";

export const WORKSPACE_SCOPE_LABEL: Record<WorkspaceScope, string> = {
  green_sales: "Green Sales",
  portal: "Portal",
};