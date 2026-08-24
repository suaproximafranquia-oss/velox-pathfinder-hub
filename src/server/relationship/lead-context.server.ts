/**
 * CONTEXTO OPERACIONAL DO LEAD PARA O MOTOR — SERVER ONLY.
 *
 * O motor não consulta banco: ele recebe daqui o estado real do lead na
 * origem. A regra que importa é uma só — enquanto o lead estiver na
 * coluna de entrada (NOVOS), a primeira ação humana ainda não
 * aconteceu e nenhuma etapa de acompanhamento pode ser programada. O
 * relógio da cadência passa a contar a partir da SAÍDA de NOVOS.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LeadStageContext = {
  awaitingFirstHumanAction: boolean;
  leftEntryStageAt: string | null;
  stageAtClosing: string | null;
};

const ENTRY_STAGE_KEY = "novos";

export async function loadLeadStageContext(leadId: string): Promise<LeadStageContext | null> {
  /**
   * IDENTIDADE DO LEAD NO MOTOR.
   *
   * O motor trabalha com o card operacional do Workspace
   * (`gs_<external_id>` em `portal_leads`), enquanto o espelho da origem
   * vive em `crm_leads` com id próprio. Sem esta tradução a consulta
   * abaixo nunca encontrava o lead e o gate da primeira ação humana
   * ficava permanentemente desligado.
   */
  const externalId = leadId.startsWith("gs_") ? leadId.slice(3) : null;
  const query = supabaseAdmin
    .from("crm_leads")
    .select("stage_key,stage_entered_at,entered_entry_stage_at");
  const { data } = await (externalId
    ? query.eq("external_source", "greensales").eq("external_id", externalId)
    : query.eq("id", leadId)
  ).maybeSingle();

  if (data) {
    const stage = data.stage_key ?? null;
    const awaiting = stage === ENTRY_STAGE_KEY;
    return {
      awaitingFirstHumanAction: awaiting,
      // A saída de NOVOS é a própria entrada na etapa atual.
      leftEntryStageAt: awaiting ? null : (data.stage_entered_at ?? null),
      stageAtClosing: stage,
    };
  }

  /**
   * COMANDO 4A §13 — LEADS NASCIDOS NO PORTAL (Portal do Investidor,
   * TikTok, Meta e link personalizado). Eles não existem no espelho do
   * GreenSales: sem este fallback o contexto voltava nulo e o portão da
   * primeira ação humana ficava desligado — a cadência avançava sozinha
   * para E1 sem ninguém ter tocado no lead.
   *
   * O equivalente à "saída de NOVOS" para esses leads é o INÍCIO DO
   * RELACIONAMENTO COMERCIAL (`relationship_started_at`): uma decisão
   * humana explícita — "Iniciar Relacionamento" no CRM ou "Solicitar
   * Atendimento" pelo investidor no Portal. Abrir o card NÃO é atividade
   * (regra do COMANDO 3). Enquanto o relacionamento não começa, nenhuma
   * etapa de acompanhamento é programada; quando começa, o relógio da E1
   * passa a contar exatamente desse instante.
   */
  const { data: portalLead } = await supabaseAdmin
    .from("portal_leads")
    .select("relationship_started_at,commercial_state")
    .eq("id", leadId)
    .maybeSingle();
  // Lead fora das duas identidades (homologação, por exemplo): sem
  // contexto, o motor mantém o comportamento anterior.
  if (!portalLead) return null;

  const archived = portalLead.commercial_state === "archived";
  const leftAt = portalLead.relationship_started_at ?? null;
  return {
    awaitingFirstHumanAction: !leftAt && !archived,
    leftEntryStageAt: leftAt,
    // Etapa equivalente no fechamento do dia: NOVOS enquanto aguarda a
    // primeira ação humana; "zero_contato" (elegível) depois dela;
    // arquivado nunca gera cadência.
    stageAtClosing: archived ? "arquivado" : leftAt ? "zero_contato" : ENTRY_STAGE_KEY,
  };
}
