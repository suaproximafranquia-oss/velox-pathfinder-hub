/**
 * Pipeline Service — etapas do nosso CRM.
 *
 * Os identificadores externos (funil 2, etapa 26 = NOVOS, etc.) vivem
 * exclusivamente na tabela `crm_pipeline_stages`. Nenhum número externo
 * é espalhado pelo código: a resolução é sempre feita por consulta.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveBoardColumn, type BoardResolution } from "@/lib/crm/board";

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
 * Resolve a COLUNA/BOARD atual do lead no funil da origem.
 *
 * A decisão inteira vive em `@/lib/crm/board`: a posição no quadro é a
 * fonte da verdade e as demais etiquetas são apenas informação. Aqui só
 * traduzimos a coluna encontrada para a etapa interna do CRM.
 */
export type StageResolution = {
  stage: PipelineStage | null;
  remarketing: boolean;
};

export function resolveBoardStage(
  pipeline: PipelineMap,
  tagIds: (string | number)[],
): StageResolution {
  const resolution: BoardResolution = resolveBoardColumn(
    pipeline.stages.map((s) => ({
      key: s.key,
      externalTag: s.externalTag,
      position: s.position,
      isEntry: s.isEntry,
    })),
    tagIds,
  );
  const stage = resolution.column
    ? (pipeline.stages.find((s) => s.key === resolution.column!.key) ?? null)
    : null;
  return { stage, remarketing: resolution.remarketing };
}

/** Compatibilidade: devolve apenas a etapa resolvida pela board. */
export function resolveStage(pipeline: PipelineMap, tagIds: (string | number)[]): PipelineStage | null {
  return resolveBoardStage(pipeline, tagIds).stage;
}
