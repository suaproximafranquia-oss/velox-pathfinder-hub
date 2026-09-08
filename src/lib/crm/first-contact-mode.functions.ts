/**
 * PRIMEIRO CONTATO (E0) — CAMINHO LEGADO DESATIVADO.
 *
 * A E0 do fluxo operacional atual pertence à régua V2 e é cobrada pela
 * Ação do Dia como ligação 1 → 10 min → ligação 2 → mensagem apenas
 * para COPIAR. Esta função permanece somente por compatibilidade: o
 * executor por trás dela recusa qualquer execução (fail-closed) e não
 * envia mensagem, não cria registro de mensagem nem aciona a Meta.
 * Nenhuma tela da Ação do Dia a utiliza.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Recusa fail-closed — mantida apenas para compatibilidade histórica. */
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
