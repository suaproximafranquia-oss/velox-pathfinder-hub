/**
 * FONTE ÚNICA DE AUTORIZAÇÃO ADMINISTRATIVA.
 *
 * A regra é a mesma para menu, rota e server function: quem decide é a
 * PERMISSÃO (user_roles / has_role), nunca o cargo operacional exibido
 * na Gestão de Usuários. Um Administrador enxerga a área mesmo quando
 * também atua como executivo ou gestor.
 */

export type AuthorizationContext = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
};

export type AdministrativeAccess = {
  /** Permissão administrativa plena. */
  admin: boolean;
  /** Permissão de gestão (leitura/operação das carteiras). */
  manager: boolean;
};

export async function readAdministrativeAccess(
  context: AuthorizationContext,
): Promise<AdministrativeAccess> {
  const [admin, manager] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  return { admin: admin.data === true, manager: manager.data === true };
}

/** Áreas administrativas (ex.: Apresentação Digital). */
export async function assertAdministrativeAccess(context: AuthorizationContext): Promise<void> {
  const access = await readAdministrativeAccess(context);
  if (!access.admin) throw new Error("Área restrita à permissão administrativa.");
}

/** Carteiras das unidades do Grupo (Solar/Seguros): Administrador ou Gestor. */
export async function assertUnitPortfolioAccess(context: AuthorizationContext): Promise<void> {
  const access = await readAdministrativeAccess(context);
  if (!access.admin && !access.manager) {
    throw new Error("Carteira restrita à permissão administrativa.");
  }
}
