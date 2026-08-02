/**
 * Promoção automática após a resposta CONFIRMAR no WhatsApp.
 *
 * O Portal promove a jornada no navegador do investidor; quando a
 * confirmação chega pelo CRM (Webhook oficial da Meta ou simulação do
 * Laboratório), o mesmo efeito precisa acontecer aqui: o Lead nasce no
 * Workspace e a comunicação é liberada.
 *
 * Regra de escopo (DEF 2.5.3 §3): quem NÃO veio de link personalizado
 * pertence ao Portal e ao Administrador responsável — nunca ao Green
 * Sales de outro executivo.
 */
import { applyLeadRouting, loadLeads, leadPhoneKey, type LeadRecord } from "@/lib/leads";
import { isJourneyOnly, startRelationship } from "@/lib/crm/commercial";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { getPortalAdministratorId } from "@/lib/portal-workspace";
import { logAudit } from "@/lib/audit-log";
import { notifySync } from "@/lib/sync-bus";

function findLeadByWhatsapp(phone: string): LeadRecord | null {
  const key = leadPhoneKey(phone);
  if (!key) return null;
  return loadLeads().find((l) => leadPhoneKey(l.whatsapp ?? "") === key) ?? null;
}

/**
 * Converte a Jornada Digital em Relacionamento Comercial. Idempotente:
 * relacionamentos já ativos permanecem intactos.
 */
export function promoteConfirmedWhatsapp(phone: string): LeadRecord | null {
  const lead = findLeadByWhatsapp(phone);
  if (!lead) return null;
  if (!isJourneyOnly(lead.id)) return lead;

  const personalized = Boolean(lead.personalized && lead.responsibleExecutiveId);
  const routed =
    applyLeadRouting(lead.id, {
      personalized,
      responsibleExecutiveId: personalized ? lead.responsibleExecutiveId : null,
    }) ?? lead;

  const ownerId = personalized
    ? (routed.responsibleExecutiveId ?? getPortalAdministratorId())
    : getPortalAdministratorId();

  startRelationship({
    investorId: routed.id,
    investorName: routed.name,
    actorId: "sistema",
    actorName: "CRM",
    actorRole: "Automatizado",
    ownerId,
    origin: routed.origin ?? "Portal Velox",
    source: "solicitacao_investidor",
  });

  recordCrmEvent({
    investorId: routed.id,
    event: "atividade_portal",
    origin: routed.origin ?? "Portal Velox",
    reason: personalized
      ? "WhatsApp confirmado — relacionamento comercial ativo no Green Sales."
      : "WhatsApp confirmado — Lead criado no Workspace / Portal e comunicação liberada.",
    ownerId,
    actorId: "sistema",
  });

  logAudit({
    actorId: "sistema",
    actorName: "CRM",
    actorRole: "Automatizado",
    module: "investidores",
    action: "WhatsApp confirmado — Portal liberado e Lead criado",
    target: routed.name,
    details: personalized
      ? "Lead vinculado ao executivo do link personalizado (Green Sales)."
      : "Lead sem link personalizado: registrado na aba Portal sob o Administrador responsável.",
    severity: "success",
  });

  notifySync("leads");
  notifySync("commercial");
  notifySync("timeline");
  notifySync("audit");
  return routed;
}
