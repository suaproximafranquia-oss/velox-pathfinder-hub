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
  const { data } = await supabaseAdmin
    .from("crm_leads")
    .select("stage_key,stage_entered_at,entered_entry_stage_at")
    .eq("id", leadId)
    .maybeSingle();
  // Lead fora do espelho da origem (homologação, por exemplo): sem
  // contexto, o motor mantém o comportamento anterior.
  if (!data) return null;

  const stage = data.stage_key ?? null;
  const awaiting = stage === ENTRY_STAGE_KEY;
  return {
    awaitingFirstHumanAction: awaiting,
    // A saída de NOVOS é a própria entrada na etapa atual.
    leftEntryStageAt: awaiting ? null : (data.stage_entered_at ?? null),
    stageAtClosing: stage,
  };
}
