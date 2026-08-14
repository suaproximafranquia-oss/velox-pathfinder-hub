/**
 * Conexão Green Sales — interface ↔ servidor.
 *
 * A conexão pertence ao Executivo autenticado. O navegador só recebe o
 * estado da conexão (dono, conta mascarada, situação): jamais credenciais.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CrmConnectionState = {
  connected: boolean;
  owner: string | null;
  accountEmail: string | null;
  status: string;
  lastVerifiedAt: string | null;
  mine: boolean;
};

export type CrmStageView = { key: string; label: string; position: number; isEntry: boolean };

async function ownerName(context: { supabase: unknown; userId: string }): Promise<string> {
  const supabase = context.supabase as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          c: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: { name: string | null } | null }> };
      };
    };
  };
  const { data } = await supabase
    .from("executive_profiles")
    .select("name")
    .eq("user_id", context.userId)
    .maybeSingle();
  return data?.name ?? "Executivo";
}

/** Estado da conexão do usuário autenticado. */
export const getGreenSalesConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmConnectionState> => {
    const { viewConnection } = await import("@/server/crm/connections.server");
    return viewConnection(context.userId, await ownerName(context));
  });

/** Conecta (ou reconecta) a conta Green Sales do usuário autenticado. */
export const connectGreenSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ email: z.string().email(), password: z.string().min(4) })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<CrmConnectionState> => {
    const { greenSalesLogin } = await import("@/server/greensales.server");
    // Só grava depois de comprovar que as credenciais realmente entram.
    await greenSalesLogin({ email: data.email, password: data.password });
    const { saveConnection, viewConnection } = await import("@/server/crm/connections.server");
    const name = await ownerName(context);
    await saveConnection({
      userId: context.userId,
      ownerName: name,
      credentials: { email: data.email, password: data.password },
    });
    return viewConnection(context.userId, name);
  });

/** Encerra a conexão do usuário autenticado. */
export const disconnectGreenSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmConnectionState> => {
    const { removeConnection, viewConnection } = await import("@/server/crm/connections.server");
    await removeConnection(context.userId);
    return viewConnection(context.userId, await ownerName(context));
  });

/** Etapas visíveis do funil, na ordem oficial. */
export const listCrmStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmStageView[]> => {
    const { data, error } = await context.supabase
      .from("crm_pipeline_stages")
      .select("key,label,position,visible,is_entry")
      .eq("visible", true)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => ({
      key: s.key,
      label: s.label,
      position: s.position,
      isEntry: Boolean(s.is_entry),
    }));
  });
