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

export function officialTemplateBody(
  investorName: string,
  _options: { personalized?: boolean } = {},
): string {
  // Mensagem oficial de boas-vindas do Portal do Investidor. Enviada
  // EXCLUSIVAMENTE para investidores orgânicos (sem link personalizado):
  // quem chega por link de Executivo não recebe validação institucional.
  return (
    `Olá, ${investorName}! Seja bem-vindo ao Portal do Investidor Velox.\n\n` +
    "Identificamos que você iniciou sua Jornada Digital para conhecer nosso modelo de franquia.\n\n" +
    "Para proteger seu progresso e liberar o acesso aos demais materiais, confirme que este WhatsApp realmente pertence a você utilizando um dos botões abaixo.\n\n" +
    "Após a confirmação, sua jornada ficará vinculada a este número e você poderá continuar de onde parou sempre que retornar.\n\n" +
    "⬜ CONFIRMAR\n" +
    "⬜ NÃO CONFIRMAR"
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
  personalized?: boolean;
}): void {
  const phone = input.phone.replace(/\D/g, "");

  appendCrmMessage({
    investorId: input.investorId,
    direction: "enviada",
    body: officialTemplateBody(input.investorName, { personalized: input.personalized }),
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