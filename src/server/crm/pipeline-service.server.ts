/**
 * Pipeline Service — etapas do nosso CRM.
 *
 * Os identificadores externos (funil 2, etapa 26 = NOVOS, etc.) vivem
 * exclusivamente na tabela `crm_pipeline_stages`. Nenhum número externo
 * é espalhado pelo código: a resolução é sempre feita por consulta.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const DEFAULT_PIPELINE_EXTERNAL_ID = "2";
export const ENTRY_STAGE_KEY = "novos";

export type PipelineStage = {
  key: string;
  label: string;
  externalTag: string;
  position: number;
  isEntry: boolean;
  visible: boolean;
};

export type PipelineMap = {
  pipelineId: string;
  externalId: string;
  name: string;
  stages: PipelineStage[];
};

export async function loadPipeline(
  externalId: string = DEFAULT_PIPELINE_EXTERNAL_ID,
): Promise<PipelineMap | null> {
  const { data: pipeline } = await supabaseAdmin
    .from("crm_pipelines")
    .select("id,external_id,name")
    .eq("external_source", "greensales")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!pipeline) return null;
  const { data: stages } = await supabaseAdmin
    .from("crm_pipeline_stages")
    .select("key,label,external_tag,position,is_entry,visible")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });
  return {
    pipelineId: pipeline.id,
    externalId: pipeline.external_id,
    name: pipeline.name,
    stages: (stages ?? []).map((s) => ({
      key: s.key,
      label: s.label,
      externalTag: s.external_tag,
      position: s.position,
      isEntry: s.is_entry,
      visible: s.visible,
    })),
  };
}

/**
 * Resolve a etapa a partir das tags do lead na origem. Quando o lead
 * carrega mais de uma tag de etapa, prevalece a de maior posição — a
 * etapa mais avançada do funil.
 */
export function resolveStage(
  pipeline: PipelineMap,
  tagIds: string[],
): PipelineStage | null {
  const wanted = new Set(tagIds.map((t) => String(t)));
  const matched = pipeline.stages.filter((s) => wanted.has(s.externalTag));
  if (!matched.length) return null;
  return matched.reduce((a, b) => (b.position > a.position ? b : a));
}
