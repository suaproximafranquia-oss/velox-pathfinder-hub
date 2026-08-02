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
  scope: "green_sales" | "redistribuicao" | "portal";
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
    // ETAPA 02.1 §Doc02 — um Lead redistribuído nunca é rebaixado por uma
    // sincronização posterior do Portal: escopo e proprietário permanecem.
    const { data: current } = await supabaseAdmin
      .from("portal_leads")
      .select("scope,responsible_executive_id,responsible_executive_slug")
      .eq("id", data.id)
      .maybeSingle();
    if (current?.scope === "redistribuicao") {
      const { error: keepError } = await supabaseAdmin
        .from("portal_leads")
        .update({
          name: data.name,
          email: data.email.toLowerCase(),
          whatsapp: data.whatsapp ?? "",
          city: data.city ?? "",
          last_activity_at: data.lastActivityAt ?? new Date().toISOString(),
        })
        .eq("id", data.id);
      if (keepError) throw new Error(keepError.message);
      return { ok: true as const, scope: "redistribuicao" as const };
    }
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
        journey: (data.journey ?? {}) as never,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, scope };
  });

/**
 * ETAPA 02.1 §Doc02 ITEM 03 — redistribuição oficial executada pela
 * Gestão. Não cria Lead, não altera histórico: apenas transfere a
 * responsabilidade operacional e fixa a origem "Redistribuição".
 */
export const redistributePortalLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; executiveId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("portal_leads")
      .update({
        scope: "redistribuicao",
        personalized: false,
        responsible_executive_id: data.executiveId,
        responsible_executive_slug: null,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Leitura da carteira — somente equipe autenticada.
 * Usa POST de propósito: leituras GET podem ser servidas do cache do
 * navegador e congelariam o Workspace em um estado antigo.
 */
export const listPortalLeads = createServerFn({ method: "POST" })
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
  .handler(async ({ data, context }) => {
    // A exclusão respeita as políticas de acesso: apenas o executivo
    // responsável pelo Lead ou um Administrador consegue removê-lo.
    const { error } = await context.supabase.from("portal_leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Recuperação da Jornada Digital em outro navegador ou dispositivo.
 *
 * O visitante não é autenticado, por isso a consulta exige e-mail E
 * WhatsApp coincidentes com o mesmo registro — nunca devolve lista, nunca
 * permite varredura da base e devolve apenas o mínimo necessário para
 * restaurar a jornada.
 */
export const lookupPortalLead = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; phone: string }) => data)
  .handler(async ({ data }) => {
    const email = (data.email ?? "").trim().toLowerCase();
    const phoneDigits = (data.phone ?? "").replace(/\D+/g, "");
    const phoneKey = phoneDigits.length > 11 ? phoneDigits.slice(-11) : phoneDigits;
    if (!email || phoneKey.length < 10) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("portal_leads")
      .select(
        "id,name,email,whatsapp,city,origin,material,scope,personalized,responsible_executive_id,created_at",
      )
      .eq("email", email)
      .limit(5);
    if (error) throw new Error(error.message);

    const match = (rows ?? []).find((row) => {
      const digitsRow = (row.whatsapp ?? "").replace(/\D+/g, "");
      const keyRow = digitsRow.length > 11 ? digitsRow.slice(-11) : digitsRow;
      return keyRow === phoneKey;
    });
    return match ?? null;
  });
