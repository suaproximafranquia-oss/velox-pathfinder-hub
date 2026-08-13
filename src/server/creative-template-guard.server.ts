/** Somente Administrador e Gestora publicam ou removem templates oficiais. */
import { getExecutiveRoleForUser } from "@/server/executive-auth.server";

export async function assertTemplateManager(userId: string): Promise<void> {
  const role = await getExecutiveRoleForUser(userId);
  if (role !== "super_admin" && role !== "diretora") {
    throw new Error("SEM_PERMISSAO_TEMPLATE");
  }
}