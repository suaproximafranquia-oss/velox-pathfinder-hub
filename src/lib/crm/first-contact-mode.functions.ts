/**
 * PRIMEIRO CONTATO (E0) — configuração de modo e execução manual.
 *
 * O modo é uma CONFIGURAÇÃO DO SERVIDOR (`crm_automation_settings`),
 * nunca uma preferência do navegador. Em modo manual, a E0 continua
 * sendo decidida pelo mesmo motor: apenas a execução passa a ser do
 * executivo, registrada com autor, horário e resultado.
 *
 * Nada aqui altera a Global WhatsApp Safety Lock nem libera envio real.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getFirstContactMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("crm_automation_settings")
      .select("first_contact_mode")
      .eq("id", true)
      .maybeSingle();
    const mode = (data as { first_contact_mode?: string | null } | null)?.first_contact_mode;
    return { mode: mode === "manual" ? ("manual" as const) : ("automatico" as const) };
  });

export const setFirstContactMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ mode: z.enum(["automatico", "manual"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, reason: "Acesso restrito ao Administrador." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("crm_automation_settings")
      .update({ first_contact_mode: data.mode } as never)
      .eq("id", true);
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, mode: data.mode };
  });

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
