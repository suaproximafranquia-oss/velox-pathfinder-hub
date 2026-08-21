/**
 * TRAVA DE SEGURANÇA DO MOTOR — SERVER ONLY (COMANDO 1B §11, 2A §115).
 *
 * Última barreira antes de qualquer saída de mensagem. Na dúvida sobre
 * a classificação do destinatário: NÃO ENVIAR.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EngineScope } from "@/lib/relationship/types";

/** Prefixo obrigatório dos leads fictícios da homologação. */
export const HOMOLOGATION_LEAD_PREFIX = "TEST-";

export type GuardResult = { ok: boolean; reason?: string };

function isHomologationLeadId(leadId: string): boolean {
  return leadId.toUpperCase().startsWith(HOMOLOGATION_LEAD_PREFIX);
}

/**
 * Homologação: só pode atuar sobre registros fictícios do próprio
 * ambiente. Um lead real jamais é aceito, mesmo que marcado como teste.
 */
export async function assertHomologationRecipient(
  leadId: string,
  runId: string | null = null,
): Promise<GuardResult> {
  if (!isHomologationLeadId(leadId)) {
    return { ok: false, reason: "Lead não pertence à homologação — envio bloqueado." };
  }
  let query = supabaseAdmin
    .from("relationship_cadences")
    .select("id")
    .eq("scope", "homologation")
    .eq("lead_id", leadId);
  query = runId ? query.eq("run_id", runId) : query.is("run_id", null);
  const { data } = await query.maybeSingle();
  if (!data) {
    return {
      ok: false,
      reason: runId
        ? `Lead fictício não pertence à rodada ${runId} — envio bloqueado.`
        : "Lead fictício não encontrado no escopo de homologação.",
    };
  }
  return { ok: true };
}

/**
 * Produção: o destinatário precisa ser um lead real com telefone válido
 * e nunca pode ser um registro de teste.
 *
 * IDENTIDADE — o motor trabalha com o card operacional do Workspace
 * (`gs_<external_id>`, carteira `portal_leads`), enquanto o espelho da
 * origem vive em `crm_leads` com id próprio. Sem esta tradução TODA
 * etapa era bloqueada com "Lead real não encontrado", e a cadência
 * morria logo após a E0.
 */
export async function assertProductionRecipient(leadId: string): Promise<GuardResult> {
  if (isHomologationLeadId(leadId)) {
    return { ok: false, reason: "Registro de teste não pode receber mensagem em produção." };
  }
  const phone = await resolveRecipientPhone(leadId);
  if (phone === null) return { ok: false, reason: "Lead real não encontrado — envio bloqueado." };
  if (phone.replace(/\D/g, "").length < 10) {
    return { ok: false, reason: "Lead sem telefone válido." };
  }
  return { ok: true };
}

/** Telefone real do destinatário, aceitando as duas identidades. */
export async function resolveRecipientPhone(leadId: string): Promise<string | null> {
  const externalId = leadId.startsWith("gs_") ? leadId.slice(3) : null;
  if (externalId) {
    const { data: card } = await supabaseAdmin
      .from("portal_leads")
      .select("whatsapp")
      .eq("id", leadId)
      .maybeSingle();
    if (card?.whatsapp) return card.whatsapp;
    const { data: mirror } = await supabaseAdmin
      .from("crm_leads")
      .select("phone")
      .eq("external_source", "greensales")
      .eq("external_id", externalId)
      .maybeSingle();
    return mirror?.phone ?? null;
  }
  const { data } = await supabaseAdmin
    .from("crm_leads")
    .select("phone")
    .eq("id", leadId)
    .maybeSingle();
  if (data) return data.phone ?? "";
  const { data: card } = await supabaseAdmin
    .from("portal_leads")
    .select("whatsapp")
    .eq("id", leadId)
    .maybeSingle();
  return card?.whatsapp ?? null;
}


export async function assertRecipientForScope(
  scope: EngineScope,
  leadId: string,
  runId: string | null = null,
): Promise<GuardResult> {
  return scope === "homologation"
    ? assertHomologationRecipient(leadId, runId)
    : assertProductionRecipient(leadId);
}