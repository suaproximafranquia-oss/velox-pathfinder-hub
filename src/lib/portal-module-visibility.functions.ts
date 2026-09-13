import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PORTAL_MODULE_VISIBILITY,
  normalizePortalModuleVisibility,
  type PortalModuleVisibility,
} from "@/lib/portal-modules";

const visibilitySchema = z.object({
  manual: z.boolean(),
  universo: z.boolean(),
  simulador: z.boolean(),
  estrutura: z.boolean(),
  revista: z.boolean(),
  principios: z.boolean(),
});

export const getPortalModuleVisibility = createServerFn({ method: "GET" }).handler(
  async (): Promise<PortalModuleVisibility> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("crm_automation_settings")
      .select("portal_modules")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return normalizePortalModuleVisibility(data?.portal_modules);
  },
);

export const savePortalModuleVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: PortalModuleVisibility) => visibilitySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito ao Administrador.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("crm_automation_settings")
      .update({ portal_modules: data })
      .eq("id", true);
    if (error) throw new Error(error.message);

    const { data: saved, error: readError } = await supabaseAdmin
      .from("crm_automation_settings")
      .select("portal_modules")
      .eq("id", true)
      .single();
    if (readError) throw new Error(readError.message);
    return {
      ok: true as const,
      visibility: normalizePortalModuleVisibility(saved.portal_modules),
    };
  });