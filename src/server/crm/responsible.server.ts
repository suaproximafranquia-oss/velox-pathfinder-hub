/**
 * RESPONSÁVEL DO CARD — resolução no servidor.
 *
 * O executivo responsável vem da IDENTIDADE REAL do usuário dono da
 * conexão que trouxe o lead (`crm_connections.user_id` →
 * `executive_profiles`). Quando não houver identidade, o card permanece
 * SEM responsável: nenhum responsável fictício, padrão ou "chutado" é
 * gravado.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ResolvedResponsible = { executiveId: string; slug: string | null } | null;

export async function resolveResponsibleByUserId(
  userId: string | null | undefined,
): Promise<ResolvedResponsible> {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from("executive_profiles")
    .select("executive_id,slug")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.executive_id) return null;
  return { executiveId: data.executive_id, slug: data.slug ?? null };
}

/**
 * RESPONSÁVEL INFORMADO PELA PRÓPRIA ORIGEM (BLOCO 2).
 *
 * A conexão que executa a sincronização NÃO define o responsável do
 * lead — quem define é o GreenSales (`vendedor_id`). O mapeamento vive
 * na MESMA tabela de executivos (`executive_profiles.greensales_vendor_id`):
 * nenhuma segunda tabela de executivos foi criada.
 *
 * Sem mapeamento resolvível o retorno é `null`: nenhum responsável é
 * inventado, nenhum lead é atribuído automaticamente a Thiago e o
 * comportamento anterior é preservado.
 */
export async function resolveResponsibleByVendorId(
  vendorId: string | number | null | undefined,
): Promise<ResolvedResponsible> {
  const value = String(vendorId ?? "").trim();
  if (!value) return null;
  const { data } = await supabaseAdmin
    .from("executive_profiles")
    .select("executive_id,slug")
    .eq("greensales_vendor_id", value)
    .maybeSingle();
  if (!data?.executive_id) return null;
  return { executiveId: data.executive_id, slug: data.slug ?? null };
}

/** Extrai o `vendedor_id` do payload bruto da origem, sem suposições. */
export function greenSalesVendorId(raw: Record<string, unknown>): string | null {
  const direct = raw["vendedor_id"];
  if (direct !== null && direct !== undefined && String(direct).trim()) {
    return String(direct).trim();
  }
  const nested = raw["vendedor"];
  if (nested && typeof nested === "object") {
    const id = (nested as Record<string, unknown>)["id"];
    if (id !== null && id !== undefined && String(id).trim()) return String(id).trim();
  }
  return null;
}

/** Responsável atual do card operacional (sem alterar nada). */
export async function readCardResponsible(
  cardId: string,
): Promise<{ exists: boolean; executiveId: string | null; slug: string | null }> {
  const { data } = await supabaseAdmin
    .from("portal_leads")
    .select("id,responsible_executive_id,responsible_executive_slug")
    .eq("id", cardId)
    .maybeSingle();
  if (!data) return { exists: false, executiveId: null, slug: null };
  return {
    exists: true,
    executiveId: data.responsible_executive_id ?? null,
    slug: data.responsible_executive_slug ?? null,
  };
}

/**
 * Preenche o responsável de um card que ainda esteja sem dono. Nunca
 * sobrescreve uma posse já existente.
 */
export async function backfillCardResponsible(
  cardId: string,
  responsible: ResolvedResponsible,
): Promise<boolean> {
  if (!responsible) return false;
  const { data } = await supabaseAdmin
    .from("portal_leads")
    .select("id,responsible_executive_id")
    .eq("id", cardId)
    .maybeSingle();
  if (!data || data.responsible_executive_id) return false;
  const { error } = await supabaseAdmin
    .from("portal_leads")
    .update({
      responsible_executive_id: responsible.executiveId,
      responsible_executive_slug: responsible.slug,
    } as never)
    .eq("id", cardId);
  return !error;
}
