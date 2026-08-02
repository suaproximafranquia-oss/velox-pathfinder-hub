/**
 * DEF 3.0.2 §3 — disparo do Template Oficial da Meta.
 *
 * Quem envia é EXCLUSIVAMENTE o CRM. O Portal apenas informa que existe
 * uma Jornada Digital aguardando validação; nenhum WhatsApp Web, nenhum
 * aplicativo e nenhuma conversa simulada é aberto no Portal.
 */
import { appendCrmMessage } from "@/lib/crm/messages";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { logAudit } from "@/lib/audit-log";
import { notifySync } from "@/lib/sync-bus";
import { dispatchWhatsappTemplate } from "@/lib/whatsapp.functions";

export function officialTemplateBody(investorName: string): string {
  return (
    `Olá, ${investorName}. Aqui é a Velox Soluções Financeiras.\n` +
    "Identificamos o início da sua jornada no Portal do Investidor. " +
    "Confirma que este WhatsApp é realmente seu?\n" +
    "Responda usando os botões desta mensagem: CONFIRMAR ou NÃO CONFIRMAR."
  );
}

/**
 * Registra o disparo na conversa do CRM e envia o Template Oficial pela
 * WhatsApp Cloud API.
 */
export function dispatchValidationTemplate(input: {
  investorId: string;
  investorName: string;
  phone: string;
  ownerId?: string | null;
  origin?: string;
  resend?: boolean;
}): void {
  const phone = input.phone.replace(/\D/g, "");

  appendCrmMessage({
    investorId: input.investorId,
    direction: "enviada",
    body: officialTemplateBody(input.investorName),
    authorId: "crm_meta",
    authorName: "CRM · Template Oficial",
  });

  recordCrmEvent({
    investorId: input.investorId,
    event: "template_automatico",
    origin: input.origin ?? "Portal Velox",
    reason: input.resend
      ? "Template Oficial da Meta reenviado automaticamente pelo CRM."
      : "Template Oficial da Meta disparado automaticamente pelo CRM.",
    ownerId: input.ownerId ?? "sistema",
    actorId: "sistema",
  });

  logAudit({
    actorId: "sistema",
    actorName: "CRM",
    actorRole: "Automatizado",
    module: "investidores",
    action: "Template Oficial da Meta enviado para validação de identidade",
    target: input.investorName,
    details: `Envio automático do CRM para ${phone}. O Portal não abriu WhatsApp Web nem aplicativo.`,
    severity: "info",
  });

  notifySync("messages");
  notifySync("timeline");
  notifySync("audit");

  void dispatchWhatsappTemplate({
    data: { phone, investorName: input.investorName, journeyId: input.investorId },
  }).catch(() => {
    /* indisponibilidade do canal não bloqueia a jornada */
  });
}