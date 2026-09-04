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
import { isSimulatedExecution, SIMULATION_LABEL } from "@/server/relationship/execution-mode.server";
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
      "id,external_id,name,phone,email,last_entry_at,external_created_at,entered_entry_stage_at,remarketing,raw_payload,is_test,test_batch_id",
    )
    .in("id", pending);

  const { registerFirstContact } = await import("@/server/crm/first-contact.server");
  for (const lead of leads ?? []) {
    summary.processed += 1;
    try {
      const raw = (lead.raw_payload ?? {}) as Record<string, unknown>;
      const isTestLead = Boolean((lead as { is_test?: boolean }).is_test);
      const testBatchId = (lead as { test_batch_id?: string | null }).test_batch_id ?? null;
      const cardId = `gs_${lead.external_id}`;
      /**
       * CONTEXTO PRESERVADO: quando o card já nasceu na entrada (caminho
       * atual), o responsável e a marcação de teste vivem NELE. A retomada
       * REUTILIZA esse card — nunca cria um segundo, nunca substitui o
       * responsável por null.
       */
      const { data: existingCard } = await supabaseAdmin
        .from("portal_leads")
        .select("id,responsible_executive_id,responsible_executive_slug,is_test,test_batch_id")
        .eq("id", cardId)
        .maybeSingle();
      const responsibleId =
        (existingCard as { responsible_executive_id?: string | null } | null)
          ?.responsible_executive_id ?? null;
      const responsibleSlug =
        (existingCard as { responsible_executive_slug?: string | null } | null)
          ?.responsible_executive_slug ?? null;

      const card = existingCard
        ? ({ ok: true as const, cardId, created: false })
        : await ensureWorkspaceCard({
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
            responsibleExecutiveId: responsibleId,
            responsibleExecutiveSlug: responsibleSlug,
            isTest: isTestLead,
            testBatchId,
          });
      if (!card.ok) {
        summary.errors.push(`Lead ${lead.external_id}: ${card.error}`);
        await recordEvent(lead.id, "workspace_card_falhou", card.error);
        continue;
      }

      /**
       * MODO OFICIAL DO RESPONSÁVEL — a retomada não pode ignorar a
       * distinção Automático x Manual. Sem responsável o mecanismo
       * oficial já devolve MANUAL (fallback seguro).
       */
      const { resolveExecutiveE0Mode } = await import("@/server/crm/first-contact-mode.server");
      const e0Mode = await resolveExecutiveE0Mode(responsibleId);
      if (e0Mode.mode === "manual") {
        const { createPendingE0Action } = await import("@/server/crm/e0-actions.server");
        const pendingAction = await createPendingE0Action({
          cardId: card.cardId,
          crmLeadId: lead.id,
          origin: "greensales",
          name: lead.name,
          whatsapp: lead.phone,
          responsibleExecutiveId: responsibleId,
          entryAt: lead.last_entry_at,
          enteredEntryStageAt: lead.entered_entry_stage_at,
          reactivation: Boolean(lead.remarketing),
        });
        if (pendingAction.created) {
          await recordEvent(
            lead.id,
            "e0_manual_pendente",
            `E0 adiada retomada na abertura da janela como ação manual no card ${card.cardId}. ${e0Mode.reason}`,
          );
        }
        continue;
      }

      const simulated = isSimulatedExecution({ isTestLead });
      const result = await registerFirstContact({
        leadId: card.cardId,
        name: lead.name,
        phone: lead.phone,
        origin: "GreenSales",
        ownerId: null,
        entryAt: lead.last_entry_at,
        enteredEntryStageAt: lead.entered_entry_stage_at,
        reactivation: Boolean(lead.remarketing),
        simulated,
      });
      if (result.registered) {
        summary.sent += 1;
        await recordEvent(
          lead.id,
          simulated ? "e0_simulada" : "e0_enviada",
          simulated
            ? `${SIMULATION_LABEL} — E0 adiada pela madrugada executada na abertura da janela (07:00).`
            : `E0 adiada pela madrugada executada na abertura da janela (07:00) no card ${card.cardId}.`,
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
