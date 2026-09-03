/**
 * MODO DO PRIMEIRO CONTATO (E0) — DECISÃO POR EXECUTIVO RESPONSÁVEL.
 *
 * Não existe mais configuração global de E0. O modo é uma permissão
 * INDIVIDUAL do executivo, gravada na mesma tabela das demais permissões
 * do Workspace (`workspace_module_permissions`, chave `e0_automatico`,
 * `user_id` = `executive_id`).
 *
 * MATRIZ OBRIGATÓRIA (validada no servidor, não só na interface):
 *   CRM ON  + Portal dos Leads ON  → Manual ou Automático;
 *   qualquer outra combinação      → Manual, sempre.
 *
 * Sem responsável resolvido o modo é MANUAL: nunca há execução
 * automática às cegas. Nada aqui altera a Global WhatsApp Safety Lock.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isHybridWorkspaceUser } from "@/lib/portal-workspace";

export type ExecutiveE0Decision = {
  mode: "automatico" | "manual";
  crm: boolean;
  portalLeads: boolean;
  automaticAllowed: boolean;
  reason: string;
};

/** Administrador é o único perfil com Portal dos Leads liberado por padrão. */
async function isAdminExecutive(executiveId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("executive_profiles")
    .select("user_id")
    .eq("executive_id", executiveId)
    .maybeSingle();
  const userId = (profile as { user_id?: string } | null)?.user_id;
  if (!userId) return false;
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(role);
}

/** Permissões efetivas do executivo, com os mesmos padrões da interface. */
export async function resolveExecutivePermissions(executiveId: string): Promise<{
  crm: boolean;
  portalLeads: boolean;
  e0Automatico: boolean;
}> {
  const { data } = await supabaseAdmin
    .from("workspace_module_permissions")
    .select("module_key,enabled")
    .eq("user_id", executiveId);
  const rows = (data ?? []) as { module_key: string; enabled: boolean }[];
  const override = (key: string): boolean | undefined =>
    rows.find((row) => row.module_key === key)?.enabled;

  const crmOverride = override("crm");
  const portalOverride = override("portal_leads");
  const e0Override = override("e0_automatico");

  const portalDefault = isHybridWorkspaceUser(executiveId)
    ? true
    : await isAdminExecutive(executiveId);

  return {
    crm: typeof crmOverride === "boolean" ? crmOverride : true,
    portalLeads: typeof portalOverride === "boolean" ? portalOverride : portalDefault,
    /** Padrão SEGURO: automático só existe por decisão explícita do Administrador. */
    e0Automatico: e0Override === true,
  };
}

/**
 * Modo do E0 do executivo RESPONSÁVEL PELO LEAD — nunca do usuário que
 * abriu a tela, nunca do cron, nunca de uma configuração global.
 */
export async function resolveExecutiveE0Mode(
  executiveId: string | null | undefined,
): Promise<ExecutiveE0Decision> {
  if (!executiveId) {
    return {
      mode: "manual",
      crm: false,
      portalLeads: false,
      automaticAllowed: false,
      reason: "Lead sem executivo responsável resolvido — primeiro contato tratado como manual.",
    };
  }

  const permissions = await resolveExecutivePermissions(executiveId);
  const automaticAllowed = permissions.crm && permissions.portalLeads;

  if (!automaticAllowed) {
    return {
      mode: "manual",
      crm: permissions.crm,
      portalLeads: permissions.portalLeads,
      automaticAllowed: false,
      reason: `Automático indisponível para ${executiveId}: CRM ${
        permissions.crm ? "ON" : "OFF"
      } e Portal dos Leads ${permissions.portalLeads ? "ON" : "OFF"}.`,
    };
  }

  return {
    mode: permissions.e0Automatico ? "automatico" : "manual",
    crm: true,
    portalLeads: true,
    automaticAllowed: true,
    reason: permissions.e0Automatico
      ? `Executivo ${executiveId} configurado em primeiro contato automático.`
      : `Executivo ${executiveId} configurado em primeiro contato manual.`,
  };
}
