/**
 * Automation Service — boas-vindas do lead novo.
 *
 * Regra central: a mensagem é enviada UMA única vez por lead. O controle
 * é feito por transição de estado no próprio banco
 * (PENDING → SENDING → SENT/FAILED), o que impede envio duplicado mesmo
 * que o sincronizador encontre o mesmo lead várias vezes.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getDefaultExecutive } from "@/lib/executive-auth";
import { investorPortalUrl } from "@/lib/portal-brands";
import { CRM_TEMPLATES, getCrmTemplate, renderCrmTemplate } from "@/lib/crm/templates";
import { recordEvent, type CrmLeadRow } from "@/server/crm/lead-service.server";
import { sendWhatsappText } from "@/server/crm/messaging.server";

export type AutomationSettings = {
  syncIntervalMinutes: number;
  welcomeEnabled: boolean;
  welcomeTemplateId: string;
  welcomeBody: string | null;
  materialUrl: string | null;
};

/** Link padrão do material — sobrescrito pela configuração quando definida. */
const DEFAULT_MATERIAL_URL = "https://velox-pathfinder-hub.lovable.app/manual";
const MAX_WELCOME_ATTEMPTS = 3;

export async function loadSettings(): Promise<AutomationSettings> {
  const { data } = await supabaseAdmin
    .from("crm_automation_settings")
    .select("sync_interval_minutes,welcome_enabled,welcome_template_id,welcome_body,material_url")
    .eq("id", true)
    .maybeSingle();
  return {
    syncIntervalMinutes: data?.sync_interval_minutes ?? 5,
    welcomeEnabled: data?.welcome_enabled ?? true,
    welcomeTemplateId: data?.welcome_template_id ?? "primeiro_contato",
    welcomeBody: data?.welcome_body ?? null,
    materialUrl: data?.material_url ?? null,
  };
}

/**
 * Texto oficial: template do CRM de Relacionamento com as variáveis
 * resolvidas pelo executivo responsável — nunca com nome gravado.
 */
export function buildWelcomeMessage(
  settings: AutomationSettings,
  _leadName?: string,
  responsible?: { name?: string | null; slug?: string | null } | null,
): { body: string; templateId: string; link: string } {
  const executive = responsible?.slug
    ? { name: responsible.name ?? "", slug: responsible.slug }
    : (() => {
        const fallback = getDefaultExecutive();
        return fallback ? { name: fallback.name, slug: fallback.slug } : null;
      })();

  const link =
    settings.materialUrl?.trim() ||
    (executive ? investorPortalUrl(executive.slug) : DEFAULT_MATERIAL_URL);

  const context = { executiveName: executive?.name ?? "", portalLink: link };
  const template = getCrmTemplate(settings.welcomeTemplateId) ?? CRM_TEMPLATES[0]!;
  const raw = settings.welcomeBody?.trim() ? settings.welcomeBody : template.body;
  const body = renderCrmTemplate(raw, context);
  const withLink = body.includes(link) ? body : `${body}\n\n${link}`;
  return { body: withLink, templateId: template.id, link };
}

export type WelcomeOutcome = "enviada" | "pendente" | "falhou" | "ignorada";

/**
 * Executa (ou não) as boas-vindas do lead. Retorna "ignorada" quando o
 * lead já foi processado ou está em processamento por outra execução.
 */
export async function processWelcome(
  lead: CrmLeadRow,
  settings: AutomationSettings,
): Promise<WelcomeOutcome> {
  if (!settings.welcomeEnabled) return "ignorada";
  if (lead.welcome_status === "SENT" || lead.welcome_status === "SENDING") return "ignorada";

  // Reserva atômica: apenas a execução que conseguir mover o estado
  // envia. Concorrência entre cron e execução manual fica resolvida.
  const claimQuery = supabaseAdmin
    .from("crm_leads")
    .update({ welcome_status: "SENDING", welcome_started_at: new Date().toISOString() })
    .eq("id", lead.id);
  const claim =
    lead.welcome_status === "FAILED"
      ? await claimQuery.eq("welcome_status", "FAILED").lt("welcome_attempts", MAX_WELCOME_ATTEMPTS).select("id").maybeSingle()
      : await claimQuery.eq("welcome_status", "PENDING").select("id").maybeSingle();
  if (!claim.data) return "ignorada";

  await recordEvent(lead.id, "boas_vindas_iniciada", "Automação de boas-vindas iniciada.");
  const message = buildWelcomeMessage(settings, lead.name);
  const result = await sendWhatsappText({ phone: lead.phone, body: message.body });

  if (result.delivered) {
    await supabaseAdmin
      .from("crm_leads")
      .update({
        welcome_status: "SENT",
        welcome_sent_at: new Date().toISOString(),
        welcome_template: message.templateId,
        welcome_link: message.link,
        welcome_error: null,
      })
      .eq("id", lead.id);
    await recordEvent(lead.id, "boas_vindas_enviada", `Mensagem enviada via ${result.provider}.`, {
      link: message.link,
      template: message.templateId,
    });
    return "enviada";
  }

  // Canal ainda não configurado não é falha do lead: fica pendente de
  // configuração e volta a ser tentado quando o provedor existir.
  if (!result.configured) {
    await supabaseAdmin
      .from("crm_leads")
      .update({
        welcome_status: "PENDING",
        welcome_started_at: null,
        welcome_error: result.error ?? "Canal de comunicação não configurado.",
      })
      .eq("id", lead.id);
    await recordEvent(
      lead.id,
      "boas_vindas_falhou",
      result.error ?? "Canal de comunicação não configurado.",
    );
    return "pendente";
  }

  const attempts = 1;
  const { data: current } = await supabaseAdmin
    .from("crm_leads")
    .select("welcome_attempts")
    .eq("id", lead.id)
    .maybeSingle();
  await supabaseAdmin
    .from("crm_leads")
    .update({
      welcome_status: "FAILED",
      welcome_template: message.templateId,
      welcome_link: message.link,
      welcome_error: result.error ?? "Falha no envio.",
      welcome_attempts: (current?.welcome_attempts ?? 0) + attempts,
    })
    .eq("id", lead.id);
  await recordEvent(lead.id, "boas_vindas_falhou", result.error ?? "Falha no envio.");
  return "falhou";
}
