/**
 * RESOLVEDOR DE DESTINOS POR LEAD — SERVER ONLY.
 *
 * Ponto único que vai de `portal_leads.responsible_executive_id` até os
 * destinos usados nos botões da mensagem oficial. Toda mensagem que
 * precisa de link personalizado ou de contato humano passa por aqui.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { investorPortalUrl } from "@/lib/portal-brands";
import { resolveDestinations, type ResolvedDestinations } from "@/lib/relationship/e0-destinations";
import { executiveSlugById } from "@/lib/relationship/executive-slug";
import { resolveLeadExecutive } from "./executive-identity.server";


export type LeadDestinations = ResolvedDestinations & {
  available: boolean;
  executiveId: string | null;
  executiveName: string | null;
  executiveSlug: string | null;
  /** Motivo legível quando não é possível seguir com o envio. */
  reason: string | null;
};

export async function resolveLeadDestinations(
  leadId: string,
  options: { portalRequired?: boolean; contactRequired?: boolean } = {},
): Promise<LeadDestinations> {
  const executive = await resolveLeadExecutive(leadId);
  if (!executive.available) {
    return {
      available: false,
      executiveId: executive.executiveId,
      executiveName: null,
      executiveSlug: null,
      portalUrl: null,
      contactUrl: null,
      contactPhone: null,
      blockers: [executive.reason],
      reason: executive.reason,
    };
  }

  /**
   * O slug do responsável é o que produz o LINK PERSONALIZADO. A fonte de
   * verdade é o CADASTRO DO EXECUTIVO (Gestão de Usuários) — o valor
   * gravado no lead é apenas um atalho e costuma vir vazio do GreenSales.
   * Ordem: valor do lead → cadastro oficial do executivo. Sem nenhum dos
   * dois, não existe link personalizado e nada é inventado.
   */
  let slug = executive.slug;
  if (!slug) {
    const { data } = await supabaseAdmin
      .from("portal_leads")
      .select("responsible_executive_slug")
      .eq("id", leadId)
      .maybeSingle();
    slug = (data as Record<string, any> | null)?.["responsible_executive_slug"] ?? null;
  }
  if (!slug) slug = executiveSlugById(executive.executiveId);


  const destinations = resolveDestinations({
    portalUrl: slug ? investorPortalUrl(slug) : null,
    executiveWhatsapp: executive.whatsapp,
    portalRequired: options.portalRequired ?? true,
    contactRequired: options.contactRequired ?? false,
  });

  return {
    ...destinations,
    available: destinations.blockers.length === 0,
    executiveId: executive.executiveId,
    executiveName: executive.name,
    executiveSlug: slug,
    reason: destinations.blockers[0] ?? null,
  };
}
