/**
 * E0 — PRIMEIRO CONTATO NO CAMINHO OFICIAL DO MOTOR (SERVER ONLY).
 *
 * Caminho ÚNICO. A E0 deixou de depender de texto fixo do CRM
 * (`CRM_FIRST_CONTACT` / `buildWelcomeMessage` / `processWelcome`) e passa
 * a se comportar exatamente como as demais etapas do motor:
 *
 *   lead elegível → resolve executivo responsável → resolve destinos
 *   → texto da Biblioteca oficial → template oficial da Meta
 *   → ambiente → idempotência → envio ou simulação
 *   → crm_messages + relationship_message_sends (snapshot congelado).
 *
 * A infraestrutura da Meta é uma só, compartilhada por todos os
 * executivos. O que muda por lead são os DESTINOS dos botões.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buttonUrlSuffix } from "@/lib/relationship/e0-destinations";
import { SIMULATION_LABEL } from "./execution-mode.server";
import { renderFromLibrary, recordMessageSnapshot } from "./message-library.server";
import { resolveLeadDestinations } from "./destinations.server";
import { E0_TEMPLATE_MISSING_REASON, loadE0MetaTemplate } from "./e0-template.server";
import {
  sendTemplateWithDestinations,
  type TemplateButtonParameter,
} from "@/server/whatsapp.server";

export const E0_STEP = "E0";

export type E0Dispatch =
  | { registered: false; reason: string }
  | {
      registered: true;
      delivered: boolean;
      simulated: boolean;
      error?: string;
      body: string;
      executiveName: string | null;
    };

export function e0MessageId(leadId: string): string {
  return `msg_e0_${leadId}`;
}

/**
 * AUDITORIA DO BLOQUEIO: toda E0 barrada por falta de destino (em
 * especial o WhatsApp do executivo responsável) fica registrada com
 * lead, executivo e motivo legível. O log nunca interrompe o fluxo.
 */
async function logE0Block(payload: {
  leadId: string;
  reason: string;
  blockers: string[];
  executiveId: string | null;
  contactMissing: boolean;
  portalMissing: boolean;
  contactButtonInTemplate: boolean;
  portalButtonInTemplate: boolean;
}): Promise<void> {
  try {
    await supabaseAdmin.from("relationship_engine_log").insert({
      scope: "production",
      action: "e0_bloqueada",
      details: payload as any,
    } as any);

  } catch {
    // Auditoria é acessória: a decisão de bloqueio já foi tomada.
  }
}


export async function dispatchFirstContact(input: {
  leadId: string;
  name: string | null;
  phone: string;
  origin: string;
  ownerId: string | null;
  /** Decisão de ambiente já tomada pelo chamador (`executionMode`). */
  simulated: boolean;
}): Promise<E0Dispatch> {
  const template = await loadE0MetaTemplate();
  const contactButton = template?.buttons.find((b) => b.role === "contato") ?? null;
  const portalButton = template?.buttons.find((b) => b.role === "portal") ?? null;

  /**
   * DESTINOS POR LEAD — REGRA FECHADA (Refino Final §2).
   *
   * O contato humano do executivo responsável é REQUISITO OPERACIONAL
   * da E0. Sem WhatsApp válido em `executive_profiles.whatsapp` a E0
   * INTEIRA é bloqueada: nada de mensagem, botão, link, número
   * institucional ou envio parcial. A ausência do botão no template
   * aprovado não autoriza o envio.
   */
  const destinations = await resolveLeadDestinations(input.leadId, {
    portalRequired: true,
    contactRequired: true,
  });
  if (!destinations.available) {
    const reason = destinations.reason ?? "Destinos não resolvidos.";
    await logE0Block({
      leadId: input.leadId,
      reason,
      blockers: destinations.blockers,
      executiveId: destinations.executiveId,
      contactMissing: !destinations.contactUrl,
      portalMissing: !destinations.portalUrl,
      contactButtonInTemplate: Boolean(contactButton),
      portalButtonInTemplate: Boolean(portalButton),
    });
    return { registered: false, reason };
  }


  // TEXTO OFICIAL: sempre a versão ativa da Biblioteca.
  const { result: rendered, message: libraryMessage } = await renderFromLibrary(E0_STEP, {
    executiveName: destinations.executiveName ?? "",
    portalLink: destinations.portalUrl ?? "",
    rawInvestorName: input.name,
  });
  if (!rendered.ok) return { registered: false, reason: rendered.reason };

  const body = rendered.button ? `${rendered.body}\n\n${rendered.button.url}` : rendered.body;
  const messageId = e0MessageId(input.leadId);
  const at = new Date().toISOString();

  /**
   * IDEMPOTÊNCIA ATÔMICA: a chave primária determinística da mensagem é
   * a trava. Retry da API, concorrência de cron e clique duplo produzem
   * conflito na segunda tentativa — nunca uma segunda E0.
   */
  const { error: insertError } = await supabaseAdmin.from("crm_messages").insert({
    id: messageId,
    investor_id: input.leadId,
    direction: "enviada",
    body,
    author_id: input.ownerId ?? "sistema",
    author_name: "Primeiro contato",
    at,
    simulated: input.simulated,
  } as any);
  if (insertError) {
    if (insertError.code === "23505") {
      return { registered: false, reason: "primeiro contato já registrado" };
    }
    return { registered: false, reason: insertError.message };
  }

  /**
   * ENTREGA EXTERNA. Simulação nunca chega à Meta. Em produção, o envio
   * usa o template aprovado com os SUFIXOS dinâmicos dos botões; sem
   * template cadastrado a entrega fica pendente, com motivo legível.
   */
  let delivered = false;
  let error: string | undefined;
  const buttons: TemplateButtonParameter[] = [];

  if (!input.simulated) {
    if (!template) {
      error = E0_TEMPLATE_MISSING_REASON;
    } else {
      let blocked: string | null = null;
      for (const button of template.buttons) {
        const destination =
          button.role === "portal"
            ? destinations.portalUrl
            : button.role === "contato"
              ? destinations.contactUrl
              : null;
        if (!destination) continue;
        const suffix = buttonUrlSuffix(button.urlBase, destination);
        if (!suffix.ok) {
          blocked = suffix.reason;
          break;
        }
        buttons.push({ index: button.index, suffix: suffix.suffix });
      }
      if (blocked) {
        error = blocked;
      } else {
        const bodyParameters = rendered.treatment ? [rendered.treatment] : [];
        const delivery = await sendTemplateWithDestinations({
          phone: input.phone,
          templateName: template.name,
          language: template.language,
          bodyParameters:
            template.bodyVariables.length > 0 ? bodyParameters : [],
          buttons,
        });
        delivered = delivery.delivered;
        error = delivery.error;
      }
    }
  }

  /**
   * SNAPSHOT CONGELADO: o passado não pode ser reescrito. Uma
   * redistribuição futura do lead não altera nada desta linha.
   */
  await recordMessageSnapshot({
    leadId: input.leadId,
    step: E0_STEP,
    renderedBody: body,
    templateBody: libraryMessage?.body ?? body,
    libraryId: libraryMessage?.id ?? null,
    libraryVersion: libraryMessage?.version ?? null,
    libraryCode: libraryMessage?.code ?? null,
    investorNameUsed: rendered.treatment,
    actorId: input.ownerId ?? null,
    actorName: "Primeiro contato",
    origin: "motor",
    messageId,
    metaTemplateName: template?.name ?? null,
    simulated: input.simulated,
    sentAt: at,
    executiveId: destinations.executiveId,
    executiveName: destinations.executiveName,
    portalDestination: destinations.portalUrl,
    contactDestination: destinations.contactUrl,
    contactPhone: destinations.contactPhone,
    buttonDestinations: {
      portal: portalButton
        ? { index: portalButton.index, url: destinations.portalUrl }
        : null,
      contato: contactButton
        ? { index: contactButton.index, url: destinations.contactUrl }
        : null,
    },
  });

  await supabaseAdmin.from("crm_timeline").insert({
    id: `tl_e0_${input.leadId}`,
    investor_id: input.leadId,
    event: "primeiro_contato",
    origin: input.origin,
    reason: input.simulated
      ? `${SIMULATION_LABEL} — E0 executada até o ponto de envio. Mensagem registrada sem entrega real (Meta não acionada).`
      : delivered
        ? "Primeiro contato enviado pelo canal oficial."
        : `Primeiro contato processado e registrado. Entrega externa pendente: ${error ?? "canal indisponível"}.`,
    owner_id: input.ownerId,
    actor_id: "sistema",
    at,
    simulated: input.simulated,
  } as any);

  return {
    registered: true,
    delivered,
    simulated: input.simulated,
    ...(error ? { error } : {}),
    body,
    executiveName: destinations.executiveName,
  };
}
