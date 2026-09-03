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
