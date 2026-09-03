/**
 * COMANDO 3B — permissões individuais de Workspace.
 *
 * Controle ON/OFF por USUÁRIO, exclusivamente para dois módulos:
 *   - CRM (e, por dependência, o Backup de Conversas);
 *   - Portal dos Leads.
 *
 * Nenhum outro módulo recebe controle individual: todos continuam
 * regidos pelo perfil e pelas regras gerais já existentes. As
 * preferências são armazenadas por identificador técnico permanente do
 * usuário — nunca pelo nome exibido — de modo que trocar o perfil
 * (Colaborador → Gestora → Administrador) jamais apaga a configuração.
 */
import type { ExecutiveRole } from "@/lib/executive-auth";
import { canAccessPortalWorkspace } from "@/lib/portal-workspace";
import {
  getWorkspacePermissionCache,
  persistWorkspacePermission,
} from "@/lib/workspace-permissions-store";

export type WorkspaceModuleKey = "crm" | "portal_leads" | "e0_automatico";

export const WORKSPACE_MODULE_LABEL: Record<WorkspaceModuleKey, string> = {
  crm: "CRM",
  portal_leads: "Portal dos Leads",
  e0_automatico: "E0 — Primeiro contato",
};

export type WorkspaceModuleOverrides = Partial<Record<WorkspaceModuleKey, boolean>>;
/** userId → preferências individuais. */
export type WorkspacePermissionMap = Record<string, WorkspaceModuleOverrides>;

const STORAGE_KEY = "atlas:workspace-permissions:v1";

/**
 * Padrão quando o Administrador nunca configurou nada para o usuário:
 *  - CRM disponível para todos os perfis operacionais;
 *  - Portal dos Leads segue a regra já existente (Administrador e o
 *    identificador técnico híbrido).
 */
export function defaultModuleAccess(
  userId: string,
  role: ExecutiveRole,
  moduleKey: WorkspaceModuleKey,
): boolean {
  if (moduleKey === "crm") return true;
  /** E0 automático nunca é padrão: só existe por decisão do Administrador. */
  if (moduleKey === "e0_automatico") return false;
  return canAccessPortalWorkspace(userId, role);
}

/** Decisão pura — usada pela interface, pelas rotas e pelos testes. */
export function resolveModuleAccess(
  map: WorkspacePermissionMap,
  userId: string,
  role: ExecutiveRole,
  moduleKey: WorkspaceModuleKey,
): boolean {
  const override = map[userId]?.[moduleKey];
  if (typeof override === "boolean") return override;
  return defaultModuleAccess(userId, role, moduleKey);
}

/**
 * MATRIZ DO E0 — automático só é válido com CRM ON e Portal dos Leads ON.
 * A mesma regra vale no servidor; aqui ela apenas espelha a decisão.
 */
export function canEnableE0Automatic(
  map: WorkspacePermissionMap,
  userId: string,
  role: ExecutiveRole,
): boolean {
  return (
    resolveModuleAccess(map, userId, role, "crm") &&
    resolveModuleAccess(map, userId, role, "portal_leads")
  );
}

/** Modo efetivo do primeiro contato deste executivo. */
export function resolveE0Mode(
  map: WorkspacePermissionMap,
  userId: string,
  role: ExecutiveRole,
): "automatico" | "manual" {
  if (!canEnableE0Automatic(map, userId, role)) return "manual";
  return resolveModuleAccess(map, userId, role, "e0_automatico") ? "automatico" : "manual";
}

/** Backup de Conversas depende integralmente do CRM (§5). */
export function resolveConversationBackupAccess(
  map: WorkspacePermissionMap,
  userId: string,
  role: ExecutiveRole,
): boolean {
  return resolveModuleAccess(map, userId, role, "crm");
}

/**
 * Escopo de leitura do Backup de Conversas (§6):
 *  - Administrador: todos os Executivos;
 *  - Gestora e Colaborador: somente o próprio, salvo autorização
 *    temporária já existente concedida pelo Administrador.
 */
export function canViewConversationBackupOf(input: {
  actorRole: ExecutiveRole;
  actorId: string;
  ownerId: string;
  temporaryGrant?: boolean;
}): boolean {
  if (input.actorRole === "super_admin") return true;
  if (input.actorId === input.ownerId) return true;
  return input.temporaryGrant === true;
}

/* ------------------ persistência: o servidor é a autoridade ------------------ */

/**
 * ATUALIZAÇÃO ESTRUTURAL §1 — a decisão vive no banco. O que existe aqui
 * é apenas a leitura do cache reativo alimentado pelo servidor
 * (`workspace-permissions-store`), nunca uma fonte de verdade local.
 */
export function loadWorkspacePermissions(): WorkspacePermissionMap {
  return getWorkspacePermissionCache();
}

/** Altera a permissão de UM usuário no servidor, sem tocar em nenhum outro. */
export async function setWorkspaceModuleAccess(
  userId: string,
  moduleKey: WorkspaceModuleKey,
  enabled: boolean,
  actorName?: string,
): Promise<WorkspacePermissionMap> {
  await persistWorkspacePermission({
    userId,
    moduleKey,
    enabled,
    ...(actorName ? { actorName } : {}),
  });
  return getWorkspacePermissionCache();
}

export function canUseWorkspaceModule(
  userId: string,
  role: ExecutiveRole,
  moduleKey: WorkspaceModuleKey,
): boolean {
  return resolveModuleAccess(getWorkspacePermissionCache(), userId, role, moduleKey);
}

export function canUseConversationBackups(userId: string, role: ExecutiveRole): boolean {
  return canUseWorkspaceModule(userId, role, "crm");
}

