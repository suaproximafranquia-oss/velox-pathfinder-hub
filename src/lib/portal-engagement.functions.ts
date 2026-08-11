/**
 * Leitura do engajamento persistido — respeitando as permissões atuais.
 *
 * A lista de investidores é obtida com o cliente autenticado do próprio
 * executivo (`context.supabase`), portanto as regras de visibilidade já
 * existentes valem integralmente: cada colaborador vê exclusivamente os
 * investidores aos quais já possui acesso.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalEngagementRow = {
  investorId: string;
  name: string;
  email: string | null;
  city: string | null;
  responsibleExecutiveId: string | null;
  sessions: number;
  returns: number;
  activeMs: number;
  modules: Record<string, string>;
  firstAccessAt: string;
  lastAccessAt: string;
};

function toRow(
  lead: { id: string; name: string; email: string | null; city: string | null; responsible_executive_id: string | null },
  engagement: Record<string, unknown>,
): PortalEngagementRow {
  return {
    investorId: lead.id,
    name: lead.name,
    email: lead.email,
    city: lead.city,
    responsibleExecutiveId: lead.responsible_executive_id,
    sessions: Number(engagement["sessions"] ?? 0),
    returns: Number(engagement["returns"] ?? 0),
    activeMs: Number(engagement["active_ms"] ?? 0),
    modules: (engagement["modules"] as Record<string, string> | null) ?? {},
    firstAccessAt: String(engagement["first_access_at"]),
    lastAccessAt: String(engagement["last_access_at"]),
  };
}

/** Engajamento de todos os investidores visíveis para quem consulta. */
export const listPortalEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalEngagementRow[]> => {
    const { data: leads, error } = await context.supabase
      .from("portal_leads")
      .select("id,name,email,city,responsible_executive_id");
    if (error) throw new Error(error.message);
    const ids = (leads ?? []).map((l) => l.id);
    if (ids.length === 0) return [];
    const { data: rows, error: engagementError } = await context.supabase
      .from("portal_engagement")
      .select("investor_id,sessions,returns,active_ms,modules,first_access_at,last_access_at")
      .in("investor_id", ids);
    if (engagementError) throw new Error(engagementError.message);
    const byId = new Map((leads ?? []).map((l) => [l.id, l]));
    return (rows ?? [])
      .map((r) => {
        const lead = byId.get(String(r.investor_id));
        return lead ? toRow(lead, r as Record<string, unknown>) : null;
      })
      .filter((r): r is PortalEngagementRow => r !== null);
  });

/** Engajamento de UM investidor — usado na Ficha do CRM. */
export const getPortalEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ investorId: z.string().min(3) }).parse(data))
  .handler(async ({ data, context }): Promise<PortalEngagementRow | null> => {
    const { data: lead } = await context.supabase
      .from("portal_leads")
      .select("id,name,email,city,responsible_executive_id")
      .eq("id", data.investorId)
      .maybeSingle();
    if (!lead) return null;
    const { data: row } = await context.supabase
      .from("portal_engagement")
      .select("investor_id,sessions,returns,active_ms,modules,first_access_at,last_access_at")
      .eq("investor_id", data.investorId)
      .maybeSingle();
    return row ? toRow(lead, row as Record<string, unknown>) : null;
  });
