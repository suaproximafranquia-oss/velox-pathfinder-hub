/**
 * FILA DA E0 ADIADA PELA JANELA OPERACIONAL (§16).
 *
 * Quando o lead novo é detectado fora da janela E0 (Seg–Sex 07:00–22:30,
 * Sáb 07:00–12:00, Dom sem envio) a E0 não é enviada: ela fica pendente
 * e é executada na próxima abertura da janela. Nada é recalculado e
 * nenhum lead antigo entra aqui — só participa da fila quem foi adiado
 * DEPOIS desta atualização (evento `e0_adiada`).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isE0NightWindow, nightDeferralReason } from "@/lib/crm/e0-window";
import { E0_SIMULATION_ENABLED, E0_SIMULATION_LABEL } from "@/lib/crm/e0-simulation";
import { recordEvent } from "@/server/crm/lead-service.server";
import { ensureWorkspaceCard } from "@/server/crm/workspace-card.server";

export type DeferredSummary = { processed: number; sent: number; errors: string[] };

/** Registra o adiamento noturno da E0 — a etapa é preservada, nunca perdida. */
export async function deferFirstContact(leadId: string, at: Date = new Date()): Promise<void> {
  await recordEvent(leadId, "e0_adiada", nightDeferralReason(at), {
    resumeAt: nightDeferralReason(at),
  });
}

/**
 * Executa as E0 adiadas assim que a janela abre. Idempotente: leads que
 * já tiveram a E0 registrada são simplesmente ignorados.
 */
export async function processDeferredFirstContacts(): Promise<DeferredSummary> {
  const summary: DeferredSummary = { processed: 0, sent: 0, errors: [] };
  if (isE0NightWindow()) return summary;

  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: deferred } = await supabaseAdmin
    .from("crm_lead_events")
    .select("lead_id")
    .eq("type", "e0_adiada")
    .gte("created_at", since)
    .limit(200);
  const leadIds = Array.from(new Set((deferred ?? []).map((row) => row.lead_id)));
  if (leadIds.length === 0) return summary;

  const { data: doneEvents } = await supabaseAdmin
    .from("crm_lead_events")
    .select("lead_id,type")
    .in("lead_id", leadIds)
    .in("type", ["e0_simulada", "boas_vindas_enviada"]);
  const done = new Set((doneEvents ?? []).map((row) => row.lead_id));
  const pending = leadIds.filter((id) => !done.has(id));
  if (pending.length === 0) return summary;

  const { data: leads } = await supabaseAdmin
    .from("crm_leads")
    .select(
      "id,external_id,name,phone,email,last_entry_at,external_created_at,entered_entry_stage_at,remarketing,raw_payload",
    )
    .in("id", pending);

  const { registerFirstContact } = await import("@/server/crm/first-contact.server");
  for (const lead of leads ?? []) {
    summary.processed += 1;
    try {
      const raw = (lead.raw_payload ?? {}) as Record<string, unknown>;
      const card = await ensureWorkspaceCard({
        externalId: lead.external_id,
        name: lead.name,
        email: lead.email,
        whatsapp: lead.phone,
        city: (raw["city"] as string) ?? null,
        material: null,
        campaign: null,
        externalCreatedAt: lead.external_created_at,
        externalUpdatedAt: (raw["updated_at"] as string) ?? null,
        rawPayload: raw,
      });
      if (!card.ok) {
        summary.errors.push(`Lead ${lead.external_id}: ${card.error}`);
        await recordEvent(lead.id, "workspace_card_falhou", card.error);
        continue;
      }
      const result = await registerFirstContact({
        leadId: card.cardId,
        name: lead.name,
        phone: lead.phone,
        origin: "GreenSales",
        ownerId: null,
        entryAt: lead.last_entry_at,
        enteredEntryStageAt: lead.entered_entry_stage_at,
        reactivation: Boolean(lead.remarketing),
        simulated: E0_SIMULATION_ENABLED,
      });
      if (result.registered) {
        summary.sent += 1;
        await recordEvent(
          lead.id,
          "e0_simulada",
          `${E0_SIMULATION_LABEL} — E0 adiada pela madrugada executada na abertura da janela (07:00).`,
        );
      } else {
        await recordEvent(lead.id, "e0_ignorada", result.reason);
      }
    } catch (error) {
      summary.errors.push(
        `Lead ${lead.external_id}: ${error instanceof Error ? error.message : "falha desconhecida"}`,
      );
    }
  }

  /**
   * COMANDO 3A §4/§8 — Leads nascidos no PORTAL também adiam a E0 na
   * madrugada. Eles não existem em `crm_leads`: a marca de adiamento fica
   * na jornada do Portal (`portal_journey_events`, `e0_adiada`) e a
   * retomada usa o MESMO `registerFirstContact` — nenhum fluxo paralelo.
   * Idempotente: quem já tem `msg_e0_` é ignorado.
   */
  const { data: portalDeferred } = await supabaseAdmin
    .from("portal_journey_events")
    .select("investor_id")
    .eq("event", "e0_adiada")
    .gte("created_at", since)
    .limit(200);
  const portalIds = Array.from(
    new Set((portalDeferred ?? []).map((row) => String(row.investor_id))),
  );
  if (portalIds.length > 0) {
    const { data: portalDone } = await supabaseAdmin
      .from("crm_messages")
      .select("id")
      .in("id", portalIds.map((id) => `msg_e0_${id}`));
    const doneIds = new Set(
      (portalDone ?? []).map((row) => String(row.id).replace(/^msg_e0_/, "")),
    );
    const pendingPortal = portalIds.filter((id) => !doneIds.has(id));
    if (pendingPortal.length > 0) {
      const { data: portalLeads } = await supabaseAdmin
        .from("portal_leads")
        .select("id,name,whatsapp,created_at,responsible_executive_id,scope,is_test")
        .in("id", pendingPortal);
      const { kickoffPortalFirstContact } = await import(
        "@/server/crm/portal-first-contact.server"
      );
      for (const lead of portalLeads ?? []) {
        // Lead de homologação segue apenas o Laboratório de Cadência.
        if (lead.is_test) continue;
        summary.processed += 1;
        try {
          const outcome = await kickoffPortalFirstContact({
            leadId: lead.id,
            name: lead.name,
            phone: lead.whatsapp ?? "",
            scope: lead.scope,
            ownerId: lead.responsible_executive_id ?? null,
            entryAt: lead.created_at,
          });
          if (outcome === "registered") summary.sent += 1;
        } catch (error) {
          summary.errors.push(
            `Lead Portal ${lead.id}: ${error instanceof Error ? error.message : "falha desconhecida"}`,
          );
        }
      }
    }
  }
  return summary;
}
