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
export async function assertHomologationRecipient(leadId: string): Promise<GuardResult> {
  if (!isHomologationLeadId(leadId)) {
    return { ok: false, reason: "Lead não pertence à homologação — envio bloqueado." };
  }
  const { data } = await supabaseAdmin
    .from("relationship_cadences")
    .select("id")
    .eq("scope", "homologation")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (!data) {
    return { ok: false, reason: "Lead fictício não encontrado no escopo de homologação." };
  }
  return { ok: true };
}

/**
 * Produção: o destinatário precisa ser um lead real com telefone válido
 * e nunca pode ser um registro de teste.
 */
export async function assertProductionRecipient(leadId: string): Promise<GuardResult> {
  if (isHomologationLeadId(leadId)) {
    return { ok: false, reason: "Registro de teste não pode receber mensagem em produção." };
  }
  const { data } = await supabaseAdmin
    .from("crm_leads")
    .select("id,phone")
    .eq("id", leadId)
    .maybeSingle();
  if (!data) return { ok: false, reason: "Lead real não encontrado — envio bloqueado." };
  const digits = (data.phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return { ok: false, reason: "Lead sem telefone válido." };
  return { ok: true };
}

export async function assertRecipientForScope(
  scope: EngineScope,
  leadId: string,
): Promise<GuardResult> {
  return scope === "homologation"
    ? assertHomologationRecipient(leadId)
    : assertProductionRecipient(leadId);
}