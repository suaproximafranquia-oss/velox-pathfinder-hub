/**
 * IDENTIDADE DO EXECUTIVO RESPONSÁVEL — SERVER ONLY (COMANDO 2A §5).
 *
 * O motor NÃO usa mais um "executivo padrão" para assinar mensagens de
 * qualquer lead. Quem assina é o executivo responsável pelo lead AGORA,
 * lido do cadastro oficial (`portal_leads.responsible_executive_id` →
 * `executive_profiles`).
 *
 * Sem responsável, ou sem perfil cadastrado, a identidade volta
 * indisponível e o envio é bloqueado com motivo legível — nunca
 * substituída pelo administrador nem por um nome inventado.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeWhatsappNumber } from "@/lib/whatsapp-number";

export type LeadExecutive =
  | {
      available: true;
      executiveId: string;
      slug: string | null;
      name: string;
      roleTitle: string | null;
      whatsapp: string | null;
      waLink: string | null;
      whatsappReason: string | null;
    }
  | { available: false; executiveId: string | null; reason: string };

export async function resolveLeadExecutive(leadId: string): Promise<LeadExecutive> {
  const { data: lead } = await supabaseAdmin
    .from("portal_leads")
    .select("responsible_executive_id,responsible_executive_slug")
    .eq("id", leadId)
    .maybeSingle();

  const row = lead as Record<string, any> | null;
  const executiveId = row?.["responsible_executive_id"] ?? null;
  if (!executiveId) {
    return {
      available: false,
      executiveId: null,
      reason: "Lead sem executivo responsável definido — envio bloqueado.",
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("executive_profiles")
    .select("executive_id,name,whatsapp,role_title,title,slug")
    .eq("executive_id", executiveId)
    .maybeSingle();
  const p = profile as Record<string, any> | null;
  const name = String(p?.["name"] ?? "").trim();
  if (!p || name.length === 0) {
    return {
      available: false,
      executiveId,
      reason: `Executivo responsável (${executiveId}) sem perfil cadastrado — envio bloqueado.`,
    };
  }

  const number = normalizeWhatsappNumber(p["whatsapp"]);
  return {
    available: true,
    executiveId,
    // COMANDO FINAL 1 §4 — o slug gravado no lead continua valendo; na
    // ausência dele, o link personalizado vem da ficha oficial do
    // executivo no servidor (nunca de valor fixo no código).
    slug: row?.["responsible_executive_slug"] ?? p["slug"] ?? null,
    name,
    roleTitle: p["title"] ?? p["role_title"] ?? null,
    whatsapp: number.valid ? number.digits : null,
    waLink: number.valid ? number.waLink : null,
    whatsappReason: number.valid ? null : number.reason,
  };
}
