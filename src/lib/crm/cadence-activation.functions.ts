/**
 * DATA DE ATIVAÇÃO DA CADÊNCIA — configuração operacional.
 *
 * Enquanto não estiver definida, nenhuma cadência automática começa
 * para lead algum. Definir a data NÃO gera etapas retroativas: apenas
 * leads que ENTRAREM na coluna NOVOS a partir dela ficam elegíveis.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCadenceActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("crm_automation_settings")
      .select("cadence_activation_date")
      .eq("id", true)
      .maybeSingle();
    return {
      activationDate:
        (data as { cadence_activation_date?: string | null } | null)?.cadence_activation_date ??
        null,
    };
  });

export const setCadenceActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, reason: "Acesso restrito ao Administrador." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("crm_automation_settings")
      .update({ cadence_activation_date: data.activationDate } as never)
      .eq("id", true);
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, activationDate: data.activationDate };
  });