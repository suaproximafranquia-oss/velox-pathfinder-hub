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

export type WorkspaceModuleKey = "crm" | "portal_leads";

export const WORKSPACE_MODULE_LABEL: Record<WorkspaceModuleKey, string> = {
  crm: "CRM",
  portal_leads: "Portal dos Leads",
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

/* --------------------------- persistência local --------------------------- */

export function loadWorkspacePermissions(): WorkspacePermissionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as WorkspacePermissionMap) : {};
  } catch {
    return {};
  }
}

export function saveWorkspacePermissions(map: WorkspacePermissionMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* armazenamento indisponível — nenhuma permissão é perdida em memória */
  }
}

/** Altera a permissão de UM usuário sem tocar em nenhum outro (§12-L). */
export function setWorkspaceModuleAccess(
  userId: string,
  moduleKey: WorkspaceModuleKey,
  enabled: boolean,
): WorkspacePermissionMap {
  const map = loadWorkspacePermissions();
  const next: WorkspacePermissionMap = {
    ...map,
    [userId]: { ...(map[userId] ?? {}), [moduleKey]: enabled },
  };
  saveWorkspacePermissions(next);
  return next;
}

export function canUseWorkspaceModule(
  userId: string,
  role: ExecutiveRole,
  moduleKey: WorkspaceModuleKey,
): boolean {
  return resolveModuleAccess(loadWorkspacePermissions(), userId, role, moduleKey);
}

export function canUseConversationBackups(userId: string, role: ExecutiveRole): boolean {
  return canUseWorkspaceModule(userId, role, "crm");
}
