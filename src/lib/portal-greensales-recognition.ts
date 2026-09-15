import { emailIdentityKey, phoneIdentityKey } from "@/lib/crm/identity";

type GreenSalesIdentityRow = {
  id: string; external_id: string; name: string; phone: string | null; email: string | null;
  external_created_at: string | null; last_entry_at: string | null;
  raw_payload: Record<string, unknown> | null; canonical_investor_id: string | null;
};

export type GreenSalesPortalRecognition = {
  cardId: string; crmLeadId: string; externalId: string;
  matchedBy: "external_id" | "phone" | "email";
};

/** Reconhece somente por chave GreenSales, telefone ou e-mail; nunca por nome. */
export async function recognizeGreenSalesPortalIdentity(input: {
  externalId?: string | null; name?: string | null; phone?: string | null; email?: string | null;
}): Promise<GreenSalesPortalRecognition | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const columns = "id,external_id,name,phone,email,external_created_at,last_entry_at,raw_payload,canonical_investor_id";
    let matchedBy: GreenSalesPortalRecognition["matchedBy"] | null = null;
    let candidates: GreenSalesIdentityRow[] = [];
    const externalId = String(input.externalId ?? "").replace(/^gs_/, "").trim();
    if (externalId) {
      const { data } = await supabaseAdmin.from("crm_leads").select(columns)
        .eq("external_source", "greensales").eq("external_id", externalId).limit(2);
      candidates = (data ?? []) as GreenSalesIdentityRow[];
      matchedBy = candidates.length === 1 ? "external_id" : null;
    }
    const phoneKey = phoneIdentityKey(input.phone);
    if (!matchedBy && phoneKey) {
      const { data } = await supabaseAdmin.from("crm_leads").select(columns)
        .eq("external_source", "greensales").ilike("phone", `%${phoneKey.slice(-8)}%`).limit(50);
      candidates = ((data ?? []) as GreenSalesIdentityRow[]).filter((row) => phoneIdentityKey(row.phone) === phoneKey);
      matchedBy = candidates.length === 1 ? "phone" : null;
    }
    const emailKey = emailIdentityKey(input.email);
    if (!matchedBy && emailKey) {
      const { data } = await supabaseAdmin.from("crm_leads").select(columns)
        .eq("external_source", "greensales").ilike("email", emailKey.slice(2)).limit(2);
      candidates = ((data ?? []) as GreenSalesIdentityRow[]).filter((row) => emailIdentityKey(row.email) === emailKey);
      matchedBy = candidates.length === 1 ? "email" : null;
    }
    const lead = matchedBy ? candidates[0] : null;
    if (!lead) return null;
    const rawPayload = lead.raw_payload ?? {};
    const { greenSalesVendorId, resolveResponsibleByVendorId } = await import(
      "@/server/crm/responsible.server"
    );
    const { ensureWorkspaceCard } = await import("@/server/crm/workspace-card.server");
    const responsible = await resolveResponsibleByVendorId(greenSalesVendorId(rawPayload));
    const card = await ensureWorkspaceCard({
      externalId: lead.external_id, name: lead.name, email: lead.email ?? "", whatsapp: lead.phone ?? "",
      externalCreatedAt: lead.external_created_at ?? lead.last_entry_at, rawPayload,
      responsibleExecutiveId: responsible?.executiveId ?? null,
      responsibleExecutiveSlug: responsible?.slug ?? null,
    });
    if (!card.ok) return null;
    await supabaseAdmin.from("relationship_engine_log").insert({
      scope: "production", action: "portal_reconheceu_identidade_greensales",
      details: { crmLeadId: lead.id, externalId: lead.external_id, matchedBy } as never,
    } as never);
    return { cardId: card.cardId, crmLeadId: lead.id, externalId: lead.external_id, matchedBy: matchedBy! };
  } catch {
    return null;
  }
}