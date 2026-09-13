import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
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
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data, error } = await supabasePublic
      .from("crm_automation_settings")
      .select("portal_modules")
      .eq("id", true)
      .maybeSingle();
    if (error) return DEFAULT_PORTAL_MODULE_VISIBILITY;
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
    return { ok: true as const, visibility: data };
  });