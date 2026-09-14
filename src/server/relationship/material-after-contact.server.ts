/**
 * ENVIO DE MATERIAL APÓS CONTATO — leitura pura e universal.
 *
 * Cada abertura relê lead, responsável, slug e versão ativa. Não cria
 * ocorrência, snapshot, envio, tarefa ou transição de cadência.
 */
import { investorManualUrl } from "@/lib/portal-brands";
import { composeMessageBody } from "@/lib/relationship/messages";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveLeadExecutive } from "./executive-identity.server";
import {
  MATERIAL_AFTER_CONTACT_STEP,
  renderFromLibrary,
} from "./message-library.server";

export type MaterialAfterContactMessage = {
  body: string | null;
  reason: string | null;
  version: number | null;
  investorNameUsed: string | null;
  executiveName: string | null;
};

export async function prepareMaterialAfterContactMessage(
  leadId: string,
): Promise<MaterialAfterContactMessage> {
  const [executive, leadResult] = await Promise.all([
    resolveLeadExecutive(leadId),
    supabaseAdmin.from("portal_leads").select("name").eq("id", leadId).maybeSingle(),
  ]);

  if (!executive.available) {
    return {
      body: null,
      reason: executive.reason,
      version: null,
      investorNameUsed: null,
      executiveName: null,
    };
  }
  if (!executive.slug) {
    return {
      body: null,
      reason: "Executivo responsável sem link personalizado — mensagem não preparada.",
      version: null,
      investorNameUsed: null,
      executiveName: executive.name,
    };
  }

  const lead = leadResult.data as { name?: string | null } | null;
  const { result, message } = await renderFromLibrary(MATERIAL_AFTER_CONTACT_STEP, {
    executiveName: executive.name,
    portalLink: investorManualUrl(executive.slug),
    rawInvestorName: lead?.name ?? null,
  });
  if (!result.ok) {
    return {
      body: null,
      reason: result.reason,
      version: message?.version ?? null,
      investorNameUsed: null,
      executiveName: executive.name,
    };
  }

  return {
    body: composeMessageBody(result.body, result.button),
    reason: null,
    version: message?.version ?? null,
    investorNameUsed: result.treatment,
    executiveName: executive.name,
  };
}