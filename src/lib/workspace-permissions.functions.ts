/**
 * ATUALIZAÇÃO ESTRUTURAL §1 — permissões de módulo com AUTORIDADE no servidor.
 *
 * Antes, o ON/OFF de CRM e Portal dos Leads existia apenas no
 * `localStorage` do navegador do Administrador: outras sessões nunca
 * enxergavam a alteração e o próprio usuário afetado continuava operando
 * com a permissão antiga. Agora o banco é a fonte da verdade; o
 * navegador mantém somente um cache de exibição.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkspacePermissionRow = {
  userId: string;
  moduleKey: string;
  enabled: boolean;
  updatedAt: string;
  updatedByName: string;
};

const moduleKey = z.enum(["crm", "portal_leads"]);

/** Leitura aberta a qualquer membro autenticado: a interface precisa reagir. */
export const listWorkspacePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspacePermissionRow[]> => {
    const { data, error } = await context.supabase
      .from("workspace_module_permissions")
      .select("user_id,module_key,enabled,updated_at,updated_by_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      userId: row.user_id,
      moduleKey: row.module_key,
      enabled: row.enabled,
      updatedAt: row.updated_at,
      updatedByName: row.updated_by_name ?? "",
    }));
  });

/**
 * Gravação restrita ao Administrador — a política de RLS já recusa
 * qualquer outro papel, portanto nenhuma checagem paralela é inventada
 * aqui: quem decide é o banco.
 */
export const setWorkspacePermission = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().min(1),
        moduleKey,
        enabled: z.boolean(),
        actorName: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<WorkspacePermissionRow[]> => {
    const { error } = await context.supabase
      .from("workspace_module_permissions")
      .upsert(
        {
          user_id: data.userId,
          module_key: data.moduleKey,
          enabled: data.enabled,
          updated_by: context.userId,
          updated_by_name: data.actorName ?? "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,module_key" },
      );
    if (error) throw new Error(error.message);

    const { data: rows, error: readError } = await context.supabase
      .from("workspace_module_permissions")
      .select("user_id,module_key,enabled,updated_at,updated_by_name");
    if (readError) throw new Error(readError.message);
    return (rows ?? []).map((row) => ({
      userId: row.user_id,
      moduleKey: row.module_key,
      enabled: row.enabled,
      updatedAt: row.updated_at,
      updatedByName: row.updated_by_name ?? "",
    }));
  });
