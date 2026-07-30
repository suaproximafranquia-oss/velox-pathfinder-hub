import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalLeadPayload = {
  id: string;
  name: string;
  email: string;
  whatsapp?: string;
  city?: string;
  origin?: string;
  material?: string;
  scope: "green_sales" | "portal";
  personalized?: boolean;
  responsibleExecutiveId?: string | null;
  responsibleExecutiveSlug?: string | null;
  campaign?: string | null;
  device?: string | null;
  createdAt?: string;
  lastActivityAt?: string;
  journey?: Record<string, unknown>;
};

/**
 * Persistência REAL do Lead (Prompt 2/3/4).
 *
 * O Gateway roda no navegador do investidor; o Workspace, no navegador do
 * executivo. Sem esta gravação no servidor o Card nunca chegaria ao
 * Workspace. Função pública de propósito: o visitante não é autenticado.
 * O escopo é decidido no cliente por `resolveLeadScope` e revalidado aqui.
 */
export const syncPortalLead = createServerFn({ method: "POST" })
  .inputValidator((data: PortalLeadPayload) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const executiveId = data.responsibleExecutiveId ?? null;
    // Revalidação do roteamento obrigatório: green_sales exige executivo.
    const scope = data.personalized && executiveId ? "green_sales" : "portal";
    const { error } = await supabaseAdmin.from("portal_leads").upsert(
      {
        id: data.id,
        name: data.name,
        email: data.email.toLowerCase(),
        whatsapp: data.whatsapp ?? "",
        city: data.city ?? "",
        origin: data.origin ?? "Portal Velox",
        material: data.material ?? "",
        scope,
        personalized: Boolean(data.personalized && executiveId),
        responsible_executive_id: scope === "green_sales" ? executiveId : null,
        responsible_executive_slug:
          scope === "green_sales" ? (data.responsibleExecutiveSlug ?? null) : null,
        campaign: data.campaign ?? null,
        device: data.device ?? null,
        created_at: data.createdAt ?? new Date().toISOString(),
        last_activity_at: data.lastActivityAt ?? new Date().toISOString(),
        journey: data.journey ?? {},
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, scope };
  });

/** Leitura da carteira — somente equipe autenticada. */
export const listPortalLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("portal_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deletePortalLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("portal_leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
