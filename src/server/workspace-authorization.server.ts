/**
 * CAMADA ÚNICA DE AUTORIZAÇÃO DO CORPORATE WORKSPACE — lado servidor.
 *
 * Aqui se resolve QUEM é o usuário (papel efetivo) usando apenas fontes
 * confiáveis do servidor:
 *   • `user_roles` / `has_role` (permissão administrativa e de gestão);
 *   • `executive_profiles` → papel oficial do executivo.
 * Nada vem do navegador: o `localStorage` continua servindo apenas à
 * interface e jamais autoriza acesso protegido.
 *
 * A decisão final é sempre a mesma função pura usada pelo menu e pelas
 * rotas (`decideWorkspaceAccess`), de modo que não existe segunda regra.
 */
import type { ExecutiveRole } from "@/lib/executive-auth";
import type { WorkspaceModuleKey } from "@/lib/workspace-permissions";
import {
  decideAllWorkspaceAccess,
  decideWorkspaceAccess,
  WORKSPACE_RESOURCE_LABEL,
  type WorkspaceResource,
} from "@/lib/workspace-authorization";
import { readAdministrativeAccess } from "@/server/authorization.server";

export type WorkspaceAuthContext = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
};

export type WorkspaceIdentity = {
  userId: string;
  executiveId: string | null;
  /** Papel efetivo — permissão do servidor prevalece sobre o cadastro. */
  role: ExecutiveRole;
  modules: Partial<Record<WorkspaceModuleKey, boolean>>;
};

/** Papel efetivo + permissões de módulo, tudo do lado servidor. */
export async function resolveWorkspaceIdentity(
  context: WorkspaceAuthContext,
): Promise<WorkspaceIdentity> {
  const access = await readAdministrativeAccess(context as never);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("executive_profiles")
    .select("executive_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  const executiveId = ((data as { executive_id?: string } | null)?.executive_id ?? null) as
    | string
    | null;

  const { getExecutiveRoleForUser } = await import("@/server/executive-auth.server");
  const cadastro = await getExecutiveRoleForUser(context.userId);

  const role: ExecutiveRole = access.admin
    ? "super_admin"
    : access.manager && cadastro !== "super_admin"
      ? "diretora"
      : cadastro;

  let modules: Partial<Record<WorkspaceModuleKey, boolean>> = {};
  if (executiveId) {
    const { resolveExecutivePermissions } = await import(
      "@/server/crm/first-contact-mode.server"
    );
    const perms = await resolveExecutivePermissions(executiveId);
    modules = {
      crm: perms.crm,
      portal_leads: perms.portalLeads,
      e0_automatico: perms.e0Automatico,
    };
  }

  return { userId: context.userId, executiveId, role, modules };
}

/** Decisão única — mesma usada por menu, rota e server function. */
export async function canAccessWorkspaceResource(
  context: WorkspaceAuthContext,
  resource: WorkspaceResource,
): Promise<boolean> {
  const identity = await resolveWorkspaceIdentity(context);
  return decideWorkspaceAccess({ role: identity.role, resource, modules: identity.modules });
}

/** Bloqueio efetivo das server functions do Corporate Workspace. */
export async function assertWorkspaceAccess(
  context: WorkspaceAuthContext,
  resource: WorkspaceResource,
): Promise<WorkspaceIdentity> {
  const identity = await resolveWorkspaceIdentity(context);
  const allowed = decideWorkspaceAccess({
    role: identity.role,
    resource,
    modules: identity.modules,
  });
  if (!allowed) {
    throw new Error(
      `Acesso não autorizado: ${WORKSPACE_RESOURCE_LABEL[resource]}.`,
    );
  }
  return identity;
}

/** Mapa completo para a interface (menu e guards de rota). */
export async function readWorkspaceAuthorization(context: WorkspaceAuthContext) {
  const identity = await resolveWorkspaceIdentity(context);
  return {
    role: identity.role,
    modules: identity.modules,
    allowed: decideAllWorkspaceAccess(identity.role, identity.modules),
  };
}
