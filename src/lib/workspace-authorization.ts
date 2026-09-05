/**
 * CAMADA ÚNICA DE AUTORIZAÇÃO DO CORPORATE WORKSPACE — decisão pura.
 *
 * Esta é a ÚNICA matriz de autorização dos recursos do Workspace. Menu,
 * rota e server function chegam à mesma decisão porque usam esta mesma
 * função — nenhum arquivo reimplementa a regra.
 *
 * Duas camadas, nesta ordem:
 *   1. PAPEL (autoridade do servidor) — decide se o recurso existe para
 *      o usuário;
 *   2. PERMISSÃO DE MÓDULO (ON/OFF individual já existente) — pode
 *      apenas RESTRINGIR o que o papel já permite, nunca ampliar.
 */
import type { ExecutiveRole } from "@/lib/executive-auth";
import type { WorkspaceModuleKey } from "@/lib/workspace-permissions";

export type WorkspaceResource =
  | "captacao"
  | "biblioteca"
  | "homologacao"
  | "revista"
  | "central_operacoes"
  | "portal_leads"
  | "apresentacao_digital"
  | "central_backup"
  | "backup_conversas"
  | "usuarios"
  | "configuracoes"
  | "remarketing";

export const WORKSPACE_RESOURCE_LABEL: Record<WorkspaceResource, string> = {
  captacao: "Central de Captação",
  biblioteca: "Biblioteca de Conteúdos",
  homologacao: "Central de Homologação",
  revista: "Revista Velox",
  central_operacoes: "Central de Operações",
  portal_leads: "Portal dos Leads",
  apresentacao_digital: "Apresentação Digital",
  central_backup: "Central de Backup",
  backup_conversas: "Backup de Conversas",
  usuarios: "Usuários",
  configuracoes: "Configurações",
  remarketing: "Remarketing",
};

export const WORKSPACE_RESOURCES = Object.keys(
  WORKSPACE_RESOURCE_LABEL,
) as WorkspaceResource[];

const ADMIN: ExecutiveRole[] = ["super_admin"];
const ADMIN_GESTAO: ExecutiveRole[] = ["super_admin", "diretora"];
const TODOS: ExecutiveRole[] = ["super_admin", "diretora", "executivo"];

/** Papéis autorizados por recurso — intenção funcional já vigente. */
const ROLE_MATRIX: Record<WorkspaceResource, ExecutiveRole[]> = {
  captacao: ADMIN_GESTAO,
  biblioteca: ADMIN_GESTAO,
  homologacao: ADMIN,
  revista: ADMIN_GESTAO,
  central_operacoes: ADMIN_GESTAO,
  portal_leads: TODOS,
  apresentacao_digital: ADMIN_GESTAO,
  central_backup: ADMIN,
  backup_conversas: TODOS,
  usuarios: ADMIN_GESTAO,
  configuracoes: ADMIN,
  remarketing: TODOS,
};

/**
 * Permissão de módulo exigida ADICIONALMENTE (quando existe). Ela só
 * restringe: sem o papel, o módulo ligado não abre nada.
 */
const MODULE_REQUIREMENT: Partial<Record<WorkspaceResource, WorkspaceModuleKey>> = {
  portal_leads: "portal_leads",
  backup_conversas: "crm",
  remarketing: "crm",
};

export function requiredModuleFor(
  resource: WorkspaceResource,
): WorkspaceModuleKey | null {
  return MODULE_REQUIREMENT[resource] ?? null;
}

export type WorkspaceAccessInput = {
  role: ExecutiveRole;
  resource: WorkspaceResource;
  /** Estado efetivo das permissões de módulo do usuário. */
  modules: Partial<Record<WorkspaceModuleKey, boolean>>;
};

export function decideWorkspaceAccess(input: WorkspaceAccessInput): boolean {
  if (!ROLE_MATRIX[input.resource].includes(input.role)) return false;
  const required = requiredModuleFor(input.resource);
  if (required && input.modules[required] === false) return false;
  return true;
}

export function decideAllWorkspaceAccess(
  role: ExecutiveRole,
  modules: Partial<Record<WorkspaceModuleKey, boolean>>,
): Record<WorkspaceResource, boolean> {
  const out = {} as Record<WorkspaceResource, boolean>;
  for (const resource of WORKSPACE_RESOURCES) {
    out[resource] = decideWorkspaceAccess({ role, resource, modules });
  }
  return out;
}
