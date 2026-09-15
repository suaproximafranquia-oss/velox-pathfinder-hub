/**
 * CARD OPERACIONAL NO WORKSPACE GREENSALES.
 *
 * O GreenSales da origem é apenas ESPELHO dos dados. A operação (card,
 * mensagens, timeline, ligações, eventos, observações, cadência) vive no
 * NOSSO Workspace GreenSales — a carteira `portal_leads` com escopo
 * `green_sales`, identificada de forma permanente por
 * `external_source = 'greensales'` + `external_id`.
 *
 * A criação é idempotente: o mesmo lead da origem sempre corresponde ao
 * mesmo card (`gs_<external_id>`). Nada é apagado e nenhum dado
 * operacional já existente é sobrescrito.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isManagementExecutive } from "@/server/crm/manager-guard.server";
import { sanitizeRawPayload } from "@/server/crm/lead-service.server";
import { emailIdentityKey, namesCompatible, phoneIdentityKey } from "@/lib/crm/identity";
import { greenSalesVendorId, resolveResponsibleByVendorId } from "@/server/crm/responsible.server";

export type WorkspaceCardInput = {
  externalId: string;
  name: string;
  email: string;
  whatsapp: string;
  city?: string | null;
  material?: string | null;
  campaign?: string | null;
  externalCreatedAt?: string | null;
  externalUpdatedAt?: string | null;
  rawPayload: unknown;
  /**
   * Executivo responsável resolvido NO SERVIDOR a partir da conexão que
   * trouxe o lead. Ausente = card nasce sem responsável (nunca é
   * inventado um responsável fictício).
   */
  responsibleExecutiveId?: string | null;
  responsibleExecutiveSlug?: string | null;
  /** Marcação técnica de teste — jamais aplicada a lead real. */
  isTest?: boolean;
  testBatchId?: string | null;
};

export type WorkspaceCardResult =
  | { ok: true; cardId: string; created: boolean }
  | { ok: false; cardId: string; created: false; error: string };

type GreenSalesIdentityRow = {
  id: string;
  external_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  external_created_at: string | null;
  last_entry_at: string | null;
  raw_payload: Record<string, unknown> | null;
  canonical_investor_id: string | null;
};

export type GreenSalesPortalRecognition = {
  cardId: string;
  crmLeadId: string;
  externalId: string;
  matchedBy: "external_id" | "phone" | "email";
};

/**
 * Reconhece um lead GreenSales antes de qualquer criação pelo Portal.
 * Nome só confirma uma chave forte; nunca é usado sozinho para fundir pessoas.
 */
export async function recognizeGreenSalesPortalIdentity(input: {
  externalId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<GreenSalesPortalRecognition | null> {
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
    const suffix = phoneKey.slice(-8);
    const { data } = await supabaseAdmin.from("crm_leads").select(columns)
      .eq("external_source", "greensales").ilike("phone", `%${suffix}%`).limit(50);
    candidates = ((data ?? []) as GreenSalesIdentityRow[]).filter(
      (row) => phoneIdentityKey(row.phone) === phoneKey,
    );
    matchedBy = candidates.length === 1 ? "phone" : null;
  }

  const emailKey = emailIdentityKey(input.email);
  if (!matchedBy && emailKey) {
    const email = emailKey.slice(2);
    const { data } = await supabaseAdmin.from("crm_leads").select(columns)
      .eq("external_source", "greensales").ilike("email", email).limit(2);
    candidates = ((data ?? []) as GreenSalesIdentityRow[]).filter(
      (row) => emailIdentityKey(row.email) === emailKey,
    );
    matchedBy = candidates.length === 1 ? "email" : null;
  }

  const lead = matchedBy ? candidates[0] : null;
  if (!lead || !namesCompatible(lead.name, input.name)) return null;
  const rawPayload = lead.raw_payload ?? {};
  const responsible = await resolveResponsibleByVendorId(greenSalesVendorId(rawPayload));
  const card = await ensureWorkspaceCard({
    externalId: lead.external_id,
    name: lead.name,
    email: lead.email ?? "",
    whatsapp: lead.phone ?? "",
    externalCreatedAt: lead.external_created_at ?? lead.last_entry_at,
    rawPayload,
    responsibleExecutiveId: responsible?.executiveId ?? null,
    responsibleExecutiveSlug: responsible?.slug ?? null,
  });
  if (!card.ok) return null;

  if (lead.canonical_investor_id) {
    const { linkCanonicalInvestor } = await import("@/server/crm/identity.server");
    await linkCanonicalInvestor({
      investorId: lead.canonical_investor_id,
      cardId: card.cardId,
      crmLeadId: lead.id,
    });
  }
  try {
    await supabaseAdmin.from("relationship_engine_log").insert({
      scope: "production",
      action: "portal_reconheceu_identidade_greensales",
      details: { crmLeadId: lead.id, externalId: lead.external_id, matchedBy } as never,
    } as never);
  } catch {
    /* auditoria acessória nunca bloqueia o acesso */
  }
  return { cardId: card.cardId, crmLeadId: lead.id, externalId: lead.external_id, matchedBy };
}

/** Origem GreenSales: atualiza SOMENTE o nome de um card já existente. */
export async function refreshWorkspaceCardName(externalId: string, name: string): Promise<void> {
  const cleanName = name.replace(/\u0000/g, "").trim();
  if (!cleanName) return;
  const { data: card, error } = await supabaseAdmin.from("portal_leads")
    .select("id,name,manual_overrides").eq("id", `gs_${externalId}`).maybeSingle();
  if (error) throw new Error(error.message);
  if (!card || card.name === cleanName || (card.manual_overrides as Record<string, unknown> | null)?.name) return;
  // Compare-and-set: não pisa numa correção manual concorrente.
  const { error: updateError } = await supabaseAdmin.from("portal_leads")
    .update({ name: cleanName }).eq("id", card.id).eq("name", card.name)
    .is("manual_overrides->name", null);
  if (updateError) throw new Error(updateError.message);
}

export async function ensureWorkspaceCard(
  input: WorkspaceCardInput,
): Promise<WorkspaceCardResult> {
  const cardId = `gs_${input.externalId}`;
  const { data: existing } = await supabaseAdmin
    .from("portal_leads")
    .select("id")
    .eq("id", cardId)
    .maybeSingle();
  if (existing) {
    await refreshWorkspaceCardName(input.externalId, input.name);
    return { ok: true, cardId, created: false };
  }


  const now = new Date().toISOString();
    /**
   * §5 — o card também recebe texto vindo da origem. Sem a limpeza do
   * NUL (\u0000) o Postgres rejeita a linha inteira e o lead ficava sem
   * card, sem que a execução inteira precisasse falhar por isso.
   */
  const { error } = await supabaseAdmin.from("portal_leads").insert(sanitizeRawPayload({
    id: cardId,
    name: input.name,
    email: input.email,
    whatsapp: input.whatsapp,
    city: input.city ?? "",
    origin: "GreenSales",
    material: input.material ?? "",
    // Lead vindo da origem pertence SEMPRE ao Workspace GreenSales.
    scope: "green_sales",
    personalized: false,
    responsible_executive_id: (await isManagementExecutive(input.responsibleExecutiveId))
      ? null
      : (input.responsibleExecutiveId ?? null),
    responsible_executive_slug: input.responsibleExecutiveSlug ?? null,
    campaign: input.campaign ?? null,
    device: null,
    created_at: input.externalCreatedAt ?? now,
    /**
     * ATIVIDADE É DO INVESTIDOR — edições feitas pela equipe no GreenSales
     * (refletidas em `external_updated_at`) NÃO são atividade e não podem
     * reclassificar o lead como "Novo". Só a entrada real conta.
     */
    last_activity_at: input.externalCreatedAt ?? now,
    journey: {} as never,
    external_source: "greensales",
    external_id: input.externalId,
    external_created_at: input.externalCreatedAt ?? null,
    external_updated_at: input.externalUpdatedAt ?? null,
    external_payload: input.rawPayload as never,
    is_test: Boolean(input.isTest),
    test_batch_id: input.testBatchId ?? null,
  }));
  if (error) return { ok: false, cardId, created: false, error: error.message };
  return { ok: true, cardId, created: true };
}
