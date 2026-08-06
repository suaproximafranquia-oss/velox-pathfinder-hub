/**
 * Governança — Etapa 2.
 *
 * Camada única de autorização para módulos administrativos, IA
 * Corporativa, Base de Conhecimento e Centro de Recursos. Todas as
 * checagens de acesso administrativas passam por aqui — nenhuma UI
 * deve reimplementar regras equivalentes.
 */
import type { ExecutiveRole } from "@/lib/executive-auth";

export type GovernanceCapability =
  | "admin.settings.manage"
  | "admin.customFields.manage"
  | "admin.users.manage"
  | "resources.manage"
  | "resources.read.restricted"
  | "ai.managerial.use";

const MATRIX: Record<GovernanceCapability, ExecutiveRole[]> = {
  "admin.settings.manage": ["super_admin"],
  "admin.customFields.manage": ["super_admin", "diretora"],
  "admin.users.manage": ["super_admin", "diretora"],
  "resources.manage": ["super_admin", "diretora"],
  "resources.read.restricted": ["super_admin", "diretora"],
  "ai.managerial.use": ["super_admin", "diretora"],
};

export function can(role: ExecutiveRole, capability: GovernanceCapability): boolean {
  return MATRIX[capability].includes(role);
}

export function requireAny(
  role: ExecutiveRole,
  capabilities: GovernanceCapability[],
): boolean {
  return capabilities.some((c) => can(role, c));
}
