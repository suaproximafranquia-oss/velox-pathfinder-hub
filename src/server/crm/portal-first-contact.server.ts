/**
 * PRIMEIRO CONTATO DOS LEADS NASCIDOS NO PORTAL (COMANDO 3A §4).
 *
 * O caminho oficial é único: qualquer lead NOVO criado pelo fluxo do
 * Portal (Home pública, link personalizado, TikTok ou Meta) entra na
 * MESMA regra de primeiro contato do restante da operação —
 * `registerFirstContact`, com elegibilidade por data de ativação, trava
 * da janela E0 (§16: Seg–Sex 07:00–22:30, Sáb 07:00–12:00, Dom sem
 * envio), idempotência por `msg_e0_` e handoff ao motor de
 * relacionamento com origem PORTAL (abertura E0_V1).
 *
 * Enquanto a homologação estiver ativa, a E0 é SIMULADA: registrada e
 * auditada, sem qualquer chamada à Meta.
 *
 * Adiamento fora da janela: a marca fica na jornada do próprio Portal
 * (`portal_journey_events`, evento `e0_adiada`) e é retomada na próxima
 * abertura pela fila oficial (`processDeferredFirstContacts`). Nenhum
 * fluxo paralelo é criado.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isE0NightWindow, nightDeferralReason } from "@/lib/crm/e0-window";
import { E0_SIMULATION_ENABLED } from "@/lib/crm/e0-simulation";

/** Evento de adiamento noturno gravado na jornada do Portal. */
export const PORTAL_E0_DEFERRED_EVENT = "e0_adiada";

const SCOPE_ORIGIN_LABEL: Record<string, string> = {
  green_sales: "Green Sales (link personalizado)",
  redistribuicao: "Redistribuição",
  portal: "Portal Velox",
  tiktok: "TikTok",
  meta: "Meta",
};

export type PortalFirstContactOutcome =
  | "deferred" // madrugada — retomada automática às 07:00
  | "registered" // E0 registrada (simulada ou entregue)
  | "skipped"; // não elegível / já registrada / desativada

export async function kickoffPortalFirstContact(input: {
  leadId: string;
  name: string;
  phone: string;
  scope: string;
  ownerId: string | null;
  /** Entrada real do lead no Portal (created_at). */
  entryAt: string | null;
}): Promise<PortalFirstContactOutcome> {
  // Redistribuição nunca inicia primeiro contato (regra do motor).
  if (input.scope === "redistribuicao") return "skipped";

  if (isE0NightWindow()) {
    await supabaseAdmin.from("portal_journey_events").insert({
      investor_id: input.leadId,
      event: PORTAL_E0_DEFERRED_EVENT,
      module: "portal",
      detail: nightDeferralReason(),
    } as never);
    return "deferred";
  }

  const { registerFirstContact } = await import("@/server/crm/first-contact.server");
  const result = await registerFirstContact({
    leadId: input.leadId,
    name: input.name,
    phone: input.phone,
    origin: SCOPE_ORIGIN_LABEL[input.scope] ?? "Portal Velox",
    ownerId: input.ownerId,
    entryAt: input.entryAt,
    enteredEntryStageAt: input.entryAt,
    entryOrigin: "PORTAL",
    simulated: E0_SIMULATION_ENABLED,
  });
  return result.registered ? "registered" : "skipped";
}
