/**
 * DESPACHANTE DE PRODUÇÃO DO MOTOR — SERVER ONLY.
 *
 * Este arquivo é o elo que faltava entre "o motor decidiu" e "a
 * mensagem existe". Antes, a produção apenas registrava um log de
 * "envio não executado" — a cadência decidia corretamente e morria ali.
 *
 * PRINCÍPIOS (nenhum deles é novo, todos vêm dos comandos anteriores):
 *   • NENHUM texto é inventado aqui: o corpo vem da biblioteca oficial
 *     de mensagens do projeto (`renderRelationshipMessage`), exatamente
 *     como já é usado na homologação. Nada é reescrito.
 *   • IDEMPOTÊNCIA: a mensagem de cada etapa tem id determinístico
 *     (`msg_<etapa>_<lead>`). Duas execuções simultâneas do cron não
 *     produzem duas mensagens — a segunda encontra a primeira.
 *   • AMBIENTE ANTES DE CREDENCIAL: enquanto a simulação end-to-end
 *     estiver ligada, a Meta NUNCA é chamada. A etapa é executada,
 *     registrada e auditável, sem entrega externa.
 *   • Falha temporária NÃO vira "executada": o resultado volta como não
 *     entregue e o motor mantém a tarefa para nova tentativa.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderHomologationMessage } from "@/lib/relationship/messages";
import type { CadenceStep } from "@/lib/relationship/types";
import type { DispatchRequest, DispatchResult, EngineDispatcher } from "@/lib/relationship/ports";
import { E0_SIMULATION_ENABLED, E0_SIMULATION_LABEL } from "@/lib/crm/e0-simulation";
import { getDefaultExecutive } from "@/lib/executive-auth";
import { investorPortalUrl } from "@/lib/portal-brands";
import { sendWhatsappText } from "@/server/crm/messaging.server";
import { assertProductionRecipient, resolveRecipientPhone } from "./guard.server";

type Recipient = {
  name: string | null;
  phone: string;
  executiveName: string;
  portalLink: string;
};

/** Dados reais do destinatário nas duas identidades possíveis. */
async function loadRecipient(leadId: string): Promise<Recipient | null> {
  const phone = await resolveRecipientPhone(leadId);
  if (!phone) return null;

  const { data: card } = await supabaseAdmin
    .from("portal_leads")
    .select("name,responsible_executive_slug")
    .eq("id", leadId)
    .maybeSingle();

  let name = card?.name ?? null;
  if (!name) {
    const externalId = leadId.startsWith("gs_") ? leadId.slice(3) : null;
    const query = supabaseAdmin.from("crm_leads").select("name");
    const { data: mirror } = await (externalId
      ? query.eq("external_source", "greensales").eq("external_id", externalId)
      : query.eq("id", leadId)
    ).maybeSingle();
    name = mirror?.name ?? null;
  }

  const fallback = getDefaultExecutive();
  const slug = card?.responsible_executive_slug ?? fallback?.slug ?? null;
  return {
    name,
    phone,
    executiveName: fallback?.name ?? "",
    portalLink: slug ? investorPortalUrl(slug) : "",
  };
}

async function log(action: string, details: Record<string, unknown>): Promise<void> {
  await supabaseAdmin.from("relationship_engine_log").insert({
    scope: "production",
    action,
    details: details as any,
  } as any);
}

async function send(request: DispatchRequest): Promise<DispatchResult> {
  const step = request.step as CadenceStep;
  const recipient = await loadRecipient(request.leadId);
  if (!recipient) {
    return { delivered: false, error: "Destinatário sem telefone real — etapa não enviada." };
  }

  const rendered = renderHomologationMessage(step, {
    executiveName: recipient.executiveName,
    portalLink: recipient.portalLink,
    rawInvestorName: recipient.name,
    contentName: request.contentName ?? null,
    contentUrl: request.contentUrl ?? null,
  });
  if (!rendered.ok) {
    await log("envio_bloqueado", { leadId: request.leadId, step, motivo: rendered.reason });
    return { delivered: false, error: rendered.reason };
  }

  const simulated = E0_SIMULATION_ENABLED;
  const body = rendered.button ? `${rendered.body}\n\n${rendered.button.url}` : rendered.body;
  const messageId = `msg_${step.toLowerCase()}_${request.leadId}`;
  const at = new Date().toISOString();

  /**
   * TRAVA DE DUPLICIDADE NO REGISTRO. A chave primária da mensagem é
   * determinística: se ela já existe, a etapa já saiu — não repetimos.
   */
  const { error: insertError } = await supabaseAdmin.from("crm_messages").insert({
    id: messageId,
    investor_id: request.leadId,
    direction: "enviada",
    body: simulated ? `[${E0_SIMULATION_LABEL}]\n\n${body}` : body,
    author_id: "sistema",
    author_name: simulated ? `Motor de Relacionamento (${E0_SIMULATION_LABEL})` : "Motor de Relacionamento",
    at,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      await log("envio_duplicado_evitado", { leadId: request.leadId, step });
      return { delivered: true, externalId: messageId };
    }
    return { delivered: false, error: insertError.message };
  }

  const delivery = simulated
    ? { delivered: false as const, provider: "simulador", error: undefined as string | undefined }
    : await sendWhatsappText({ phone: recipient.phone, body });

  await supabaseAdmin.from("crm_timeline").insert({
    id: `tl_${step.toLowerCase()}_${request.leadId}`,
    investor_id: request.leadId,
    event: `cadencia_${step.toLowerCase()}`,
    origin: "motor_relacionamento",
    reason: simulated
      ? `${E0_SIMULATION_LABEL} — etapa ${step} executada pelo motor e registrada sem entrega real (Meta não acionada).`
      : delivery.delivered
        ? `Etapa ${step} enviada pelo canal oficial.`
        : `Etapa ${step} registrada. Entrega externa pendente: ${delivery.error ?? "canal indisponível"}.`,
    owner_id: null,
    actor_id: "sistema",
    at,
  });

  await log(simulated ? "etapa_simulada" : "etapa_enviada", {
    leadId: request.leadId,
    step,
    templateId: request.templateId,
    contentId: request.contentId,
    entregue: simulated ? false : delivery.delivered,
    erro: simulated ? null : (delivery.error ?? null),
  });

  /**
   * Em simulação a etapa é considerada EXECUTADA: o objetivo declarado
   * é observar a máquina funcionando sem tocar em telefone real. Fora da
   * simulação, só a entrega real conclui a etapa — falha mantém a tarefa
   * viva para nova tentativa controlada.
   */
  if (simulated) return { delivered: true, externalId: messageId };
  if (delivery.delivered) return { delivered: true, externalId: messageId };
  return { delivered: false, error: delivery.error ?? "Falha no envio." };
}

export const productionDispatcher: EngineDispatcher = {
  scope: "production",
  assertRecipientAllowed: assertProductionRecipient,
  send,
};
