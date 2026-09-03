/**
 * PRIMEIRO CONTATO (E0) — execução manual pelo executivo.
 *
 * O MODO (manual/automático) não vive mais aqui: é uma permissão
 * individual do executivo responsável pelo lead, em
 * Usuários → Permissões do Workspace. Este módulo trata apenas da
 * EXECUÇÃO da ação pendente, registrada com autor, horário e resultado.
 *
 * Nada aqui altera a Global WhatsApp Safety Lock nem libera envio real.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Execução manual da E0 pendente — mesmo executor oficial do modo automático. */
export const executeFirstContactAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ actionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("executive_profiles")
      .select("executive_id,name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const executedBy =
      (profile as { executive_id?: string; name?: string } | null)?.name ??
      (profile as { executive_id?: string } | null)?.executive_id ??
      context.userId;
    const { executeE0Action } = await import("@/server/crm/e0-actions.server");
    return executeE0Action({
      actionId: data.actionId,
      executedBy,
      executedByUserId: context.userId,
    });
  });
