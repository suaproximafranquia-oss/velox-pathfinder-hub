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
};

/** Link padrão do material — sobrescrito pela configuração quando definida. */
const DEFAULT_MATERIAL_URL = "https://velox-pathfinder-hub.lovable.app/manual";
const MAX_WELCOME_ATTEMPTS = 3;

export async function loadSettings(): Promise<AutomationSettings> {
  const { data } = await supabaseAdmin
    .from("crm_automation_settings")
    .select(
      "sync_interval_minutes,welcome_enabled,welcome_template_id,welcome_body,material_url,cadence_activation_date",
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
  };
}

/** Data de ativação da cadência — leitura direta, sem valor embutido. */
export async function loadCadenceActivationDate(): Promise<string | null> {
  const settings = await loadSettings();
  return settings.cadenceActivationDate;
}

export type WelcomeOutcome = "enviada" | "pendente" | "falhou" | "ignorada";

/**
 * CAMINHO LEGADO DESATIVADO — CAMINHO ÚNICO DA E0.
 *
 * O primeiro contato pertence integralmente ao motor de relacionamento
 * (`registerFirstContact` → `dispatchFirstContact`), que resolve o
 * executivo responsável real, o texto da Biblioteca oficial e os
 * destinos dinâmicos dos botões. Esta automação não constrói mais texto
 * nem chama o canal: dois motores de primeiro contato nunca coexistem.
 *
 * Nada foi apagado do passado: leads já processados mantêm histórico,
 * estados e mensagens. Apenas não existe mais um segundo emissor.
 */
export async function processWelcome(
  _lead: CrmLeadRow,
  _settings: AutomationSettings,
): Promise<WelcomeOutcome> {
  return "ignorada";
}
