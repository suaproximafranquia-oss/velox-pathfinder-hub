/**
 * CONTATO DO EXECUTIVO RESPONSÁVEL — SERVER ONLY.
 *
 * O botão "Falar com o executivo" só existe quando existe, de fato,
 * alguém para atender: um responsável definido E um WhatsApp cadastrado
 * no perfil dele. Sem os dois, o botão simplesmente não aparece — nunca
 * cai em número genérico e nunca leva o investidor a uma conversa vazia.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeWhatsappNumber } from "@/lib/whatsapp-number";

export type ExecutiveContact = {
  available: boolean;
  executiveId: string | null;
  name: string | null;
  roleTitle: string | null;
  whatsapp: string | null;
  waLink: string | null;
  reason?: string;
};

const UNAVAILABLE: ExecutiveContact = {
  available: false,
  executiveId: null,
  name: null,
  roleTitle: null,
  whatsapp: null,
  waLink: null,
  reason: "Sem executivo responsável com WhatsApp cadastrado.",
};

export async function resolveExecutiveContact(leadId: string): Promise<ExecutiveContact> {
  const { data: lead } = await supabaseAdmin
    .from("portal_leads")
    .select("responsible_executive_id")
    .eq("id", leadId)
    .maybeSingle();
  const executiveId = (lead as Record<string, any> | null)?.["responsible_executive_id"] ?? null;
  if (!executiveId) return UNAVAILABLE;

  const { data: profile } = await supabaseAdmin
    .from("executive_profiles")
    .select("executive_id,name,whatsapp,role_title")
    .eq("executive_id", executiveId)
    .maybeSingle();
  const row = profile as Record<string, any> | null;
  // Normalização única do número (COMANDO 2A §6): sem link improvisado.
  const number = normalizeWhatsappNumber(row?.["whatsapp"]);
  if (!row || !number.valid) {
    return {
      ...UNAVAILABLE,
      executiveId,
      name: row?.["name"] ?? null,
      roleTitle: row?.["role_title"] ?? null,
      reason: number.valid ? UNAVAILABLE.reason : number.reason,
    };
  }

  return {
    available: true,
    executiveId,
    name: row["name"] ?? null,
    roleTitle: row["role_title"] ?? null,
    whatsapp: number.digits,
    waLink: number.waLink,
  };
}
