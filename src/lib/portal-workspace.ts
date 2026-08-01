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

/**
 * DEF 2.5.3 §1 — o perfil híbrido opera com AS MESMAS regras do
 * Administrador: enxerga GreenSales e Portal integralmente, sem filtro
 * adicional por carteira, independentemente do perfil ativo.
 */
export function canViewFullWorkspace(
  userId: string,
  role: ExecutiveRole,
): boolean {
  return (
    role === "super_admin" || role === "diretora" || isHybridWorkspaceUser(userId)
  );
}

/**
 * DEF 2.5.3 §3 — todo Lead originado do Portal pertence ao Administrador
 * responsável pelo Portal. Nunca há redistribuição automática para outro
 * Executivo.
 */
export function getPortalAdministratorId(): string {
  if (typeof window === "undefined") return HYBRID_WORKSPACE_USER_IDS[0]!;
  try {
    // Import estático evitado: `executive-auth` também consome este módulo.
    const raw = window.localStorage.getItem("atlas:users:v3");
    const users = raw
      ? (JSON.parse(raw) as { id: string; role: string; status?: string }[])
      : [];
    const admin = users.find((u) => u.role === "super_admin" && u.status !== "inativo");
    if (admin) return admin.id;
  } catch {
    /* base indisponível — usa o identificador técnico permanente */
  }
  return HYBRID_WORKSPACE_USER_IDS[0]!;
}

export type WorkspaceScope = "green_sales" | "portal";

export const WORKSPACE_SCOPE_LABEL: Record<WorkspaceScope, string> = {
  green_sales: "Green Sales",
  portal: "Portal",
};