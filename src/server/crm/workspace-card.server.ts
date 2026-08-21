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
  /** Marcação técnica de teste — jamais aplicada a lead real. */
  isTest?: boolean;
  testBatchId?: string | null;
};

export type WorkspaceCardResult =
  | { ok: true; cardId: string; created: boolean }
  | { ok: false; cardId: string; created: false; error: string };

export async function ensureWorkspaceCard(
  input: WorkspaceCardInput,
): Promise<WorkspaceCardResult> {
  const cardId = `gs_${input.externalId}`;
  const { data: existing } = await supabaseAdmin
    .from("portal_leads")
    .select("id")
    .eq("id", cardId)
    .maybeSingle();
  if (existing) return { ok: true, cardId, created: false };

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("portal_leads").insert({
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
    responsible_executive_id: null,
    responsible_executive_slug: null,
    campaign: input.campaign ?? null,
    device: null,
    created_at: input.externalCreatedAt ?? now,
    last_activity_at: input.externalUpdatedAt ?? input.externalCreatedAt ?? now,
    journey: {} as never,
    external_source: "greensales",
    external_id: input.externalId,
    external_created_at: input.externalCreatedAt ?? null,
    external_updated_at: input.externalUpdatedAt ?? null,
    external_payload: input.rawPayload as never,
    is_test: Boolean(input.isTest),
    test_batch_id: input.testBatchId ?? null,
  });
  if (error) return { ok: false, cardId, created: false, error: error.message };
  return { ok: true, cardId, created: true };
}
