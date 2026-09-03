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
import {
  CRM_TEMPLATES,
  getCrmTemplate,
  pickOpeningTemplate,
  renderCrmTemplate,
} from "@/lib/crm/templates";
import { recordEvent, type CrmLeadRow } from "@/server/crm/lead-service.server";
import { sendWhatsappText } from "@/server/crm/messaging.server";
import { engineOwnsFirstContact } from "@/lib/relationship/config";
import { firstName, looksLikeName, NEUTRAL_TREATMENT } from "@/lib/relationship/names";

export type AutomationSettings = {
  syncIntervalMinutes: number;
  welcomeEnabled: boolean;
  welcomeTemplateId: string;
  welcomeBody: string | null;
  materialUrl: string | null;
  /**
   * Data (YYYY-MM-DD) a partir da qual a cadência automática pode
   * começar. Vazia = nenhuma cadência é iniciada para lead algum.
   */
  cadenceActivationDate: string | null;
  /**
   * LEGADO / AUDITORIA — antigo modo GLOBAL do primeiro contato.
   * NÃO é mais fonte de decisão: o modo do E0 passou a ser individual
   * por executivo (`workspace_module_permissions.e0_automatico`),
   * resolvido em `first-contact-mode.server.ts`. O valor permanece
   * gravado apenas como registro histórico.
   */
  firstContactMode: "automatico" | "manual";
};

/** Link padrão do material — sobrescrito pela configuração quando definida. */
const DEFAULT_MATERIAL_URL = "https://velox-pathfinder-hub.lovable.app/manual";
const MAX_WELCOME_ATTEMPTS = 3;

export async function loadSettings(): Promise<AutomationSettings> {
  const { data } = await supabaseAdmin
    .from("crm_automation_settings")
    .select(
      "sync_interval_minutes,welcome_enabled,welcome_template_id,welcome_body,material_url,cadence_activation_date,first_contact_mode",
    )
    .eq("id", true)
    .maybeSingle();
  return {
    syncIntervalMinutes: data?.sync_interval_minutes ?? 5,
    welcomeEnabled: data?.welcome_enabled ?? true,
    welcomeTemplateId: data?.welcome_template_id ?? "primeiro_contato",
    welcomeBody: data?.welcome_body ?? null,
    materialUrl: data?.material_url ?? null,
    cadenceActivationDate:
      (data as { cadence_activation_date?: string | null } | null)?.cadence_activation_date ?? null,
    firstContactMode:
      (data as { first_contact_mode?: string | null } | null)?.first_contact_mode === "manual"
        ? "manual"
        : "automatico",
  };
}

/** Data de ativação da cadência — leitura direta, sem valor embutido. */
export async function loadCadenceActivationDate(): Promise<string | null> {
  const settings = await loadSettings();
  return settings.cadenceActivationDate;
}

export type WelcomeOutcome = "enviada" | "pendente" | "falhou" | "ignorada";

/**
 * O primeiro contato pertence integralmente ao motor de relacionamento
 * (`registerFirstContact` → `dispatchFirstContact`). A função legada
 * `processWelcome` foi REMOVIDA no Comando 3: não existe segundo
 * emissor de primeiro contato. Históricos permanecem intactos.
 */
