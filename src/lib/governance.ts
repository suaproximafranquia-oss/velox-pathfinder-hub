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
  | "knowledge.manage"
  | "knowledge.read.restricted"
  | "resources.manage"
  | "resources.read.restricted"
  | "ai.corporate.use"
  | "ai.managerial.use"
  | "audit.read";

const MATRIX: Record<GovernanceCapability, ExecutiveRole[]> = {
  "admin.settings.manage": ["super_admin"],
  "admin.customFields.manage": ["super_admin", "diretora"],
  "admin.users.manage": ["super_admin", "diretora"],
  "knowledge.manage": ["super_admin", "diretora"],
  "knowledge.read.restricted": ["super_admin", "diretora"],
  "resources.manage": ["super_admin", "diretora"],
  "resources.read.restricted": ["super_admin", "diretora"],
  "ai.corporate.use": ["super_admin", "diretora", "executivo"],
  "ai.managerial.use": ["super_admin", "diretora"],
  "audit.read": ["super_admin", "diretora"],
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

/** Público-alvo para filtragem de conteúdo restrito × público. */
export function audienceFor(role: ExecutiveRole): "publico" | "interno" {
  return can(role, "knowledge.read.restricted") ? "interno" : "publico";
}