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
    const email = data.email.trim().toLowerCase();
    const digits = (data.whatsapp ?? "").replace(/\D+/g, "");
    const phoneKey = digits.length > 11 ? digits.slice(-11) : digits;

    /**
     * DEDUPE OFICIAL — a MESMA pessoa nunca vira dois leads.
     *
     * Um investidor que já existe (ex.: carteira do Thiago) e volta pelo
     * link personalizado de outro executivo (ex.: Larissa) NÃO gera novo
     * registro: reaproveitamos o lead existente, preservamos o
     * proprietário atual e gravamos a nova entrada como EVENTO,
     * atribuído ao executivo do link.
     */
    const { data: byIdentity } = await supabaseAdmin
      .from("portal_leads")
      .select("id,scope,responsible_executive_id,responsible_executive_slug,whatsapp")
      .eq("email", email)
      .limit(10);
    const duplicate = (byIdentity ?? []).find((row) => {
      if (row.id === data.id) return false;
      if (!phoneKey) return true; // mesmo e-mail já basta quando não há telefone
      const d = (row.whatsapp ?? "").replace(/\D+/g, "");
      const key = d.length > 11 ? d.slice(-11) : d;
      return !key || key === phoneKey;
    });

    const targetId = duplicate?.id ?? data.id;
    const { data: current } = await supabaseAdmin
      .from("portal_leads")
      .select("scope,responsible_executive_id,responsible_executive_slug")
      .eq("id", targetId)
      .maybeSingle();

    const registerEntry = async (reason: string) => {
      await supabaseAdmin.from("portal_journey_events").insert({
        investor_id: targetId,
        event: "journey.entry.registered",
        module: "portal",
        detail: reason,
      } as never);
    };

    if (duplicate) {
      // Ownership respeitado: quem já responde pelo lead continua
      // respondendo. Apenas atualizamos os dados e registramos a entrada.
      const { error: dedupeError } = await supabaseAdmin
        .from("portal_leads")
        .update({
          name: data.name,
          email,
          whatsapp: data.whatsapp ?? "",
          city: data.city ?? "",
          last_activity_at: data.lastActivityAt ?? new Date().toISOString(),
        })
        .eq("id", targetId);
      if (dedupeError) throw new Error(dedupeError.message);
      await registerEntry(
        data.personalized && data.responsibleExecutiveSlug
          ? `Nova entrada pelo link personalizado de ${data.responsibleExecutiveSlug} — lead já existente, sem duplicação.`
          : "Nova entrada pelo Portal institucional — lead já existente, sem duplicação.",
      );
      return {
        ok: true as const,
        scope: (current?.scope ?? "portal") as "green_sales" | "redistribuicao" | "portal",
        leadId: targetId,
        deduped: true as const,
      };
    }

    // ETAPA 02.1 §Doc02 — um Lead redistribuído nunca é rebaixado por uma
    // sincronização posterior do Portal: escopo e proprietário permanecem.
    if (current?.scope === "redistribuicao") {
      const { error: keepError } = await supabaseAdmin
        .from("portal_leads")
        .update({
          name: data.name,
          email,
          whatsapp: data.whatsapp ?? "",
          city: data.city ?? "",
          last_activity_at: data.lastActivityAt ?? new Date().toISOString(),
        })
        .eq("id", targetId);
      if (keepError) throw new Error(keepError.message);
      return {
        ok: true as const,
        scope: "redistribuicao" as const,
        leadId: targetId,
        deduped: false as const,
      };
    }
    // Revalidação do roteamento obrigatório: green_sales exige executivo.
    const scope = data.personalized && executiveId ? "green_sales" : "portal";
    // O proprietário definido por uma transferência oficial nunca é
    // apagado por uma sincronização posterior da jornada.
    const preservedOwner =
      current?.responsible_executive_id ??
      (scope === "green_sales" ? executiveId : null);
    const { error } = await supabaseAdmin.from("portal_leads").upsert(
      {
        id: targetId,
        name: data.name,
        email,
        whatsapp: data.whatsapp ?? "",
        city: data.city ?? "",
        origin: data.origin ?? "Portal Velox",
        material: data.material ?? "",
        scope,
        personalized: Boolean(data.personalized && executiveId),
        responsible_executive_id: preservedOwner,
        responsible_executive_slug:
          scope === "green_sales"
            ? (current?.responsible_executive_slug ?? data.responsibleExecutiveSlug ?? null)
            : null,
        campaign: data.campaign ?? null,
        device: data.device ?? null,
        created_at: data.createdAt ?? new Date().toISOString(),
        last_activity_at: data.lastActivityAt ?? new Date().toISOString(),
        journey: (data.journey ?? {}) as never,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    /**
     * SEPARAÇÃO DE CONTEXTOS: iniciar a jornada no Portal do Investidor
     * é um evento do PORTAL. Ele não gera mensagem automática no CRM de
     * Relacionamento — o primeiro contato do CRM pertence à entrada do
     * lead pela origem comercial (GreenSales → Workspace → CRM).
     */
    return { ok: true as const, scope, leadId: targetId, deduped: false as const };
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
 */
/**
 * Transferência oficial de proprietário (Gestora/Administrador).
 *
 * Diferente da redistribuição, aqui a carteira de origem é preservada:
 * apenas o Executivo responsável muda — e muda de verdade, na base.
 */
export const assignPortalLeadOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; executiveId: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("portal_leads")
      .update({
        responsible_executive_id: data.executiveId,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
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
