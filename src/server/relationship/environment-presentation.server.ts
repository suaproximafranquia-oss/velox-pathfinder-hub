/**
 * APRESENTAÇÃO VIGENTE POR AMBIENTE — SERVER ONLY.
 *
 * Regra fechada: existe NO MÁXIMO UMA apresentação vigente por ambiente
 * (Financeira, Solar, Seguradora). Não há apresentações simultâneas por
 * campanha e nada aqui interfere nos capítulos versionados nem nas
 * apresentações já emitidas — aquelas continuam com o roteiro congelado.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EnvironmentPresentation = {
  environment: string;
  introText: string | null;
  videoUrl: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
};

type Row = {
  environment: string;
  intro_text: string | null;
  video_url: string | null;
  is_published: boolean | null;
  published_at: string | null;
  updated_at: string | null;
};

function toRecord(row: Row): EnvironmentPresentation {
  return {
    environment: row.environment,
    introText: row.intro_text,
    videoUrl: row.video_url,
    isPublished: row.is_published === true,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export async function listEnvironmentPresentations(): Promise<EnvironmentPresentation[]> {
  const { data, error } = await supabaseAdmin
    .from("environment_presentations")
    .select("environment,intro_text,video_url,is_published,published_at,updated_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toRecord);
}

/** Grava a apresentação do ambiente — uma linha por ambiente, sempre. */
export async function saveEnvironmentPresentation(params: {
  environment: string;
  introText: string;
  videoUrl: string;
  isPublished: boolean;
  actorId: string | null;
}): Promise<EnvironmentPresentation> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("environment_presentations")
    .upsert(
      {
        environment: params.environment,
        intro_text: params.introText || null,
        video_url: params.videoUrl || null,
        is_published: params.isPublished,
        published_at: params.isPublished ? nowIso : null,
        published_by: params.isPublished ? params.actorId : null,
        updated_at: nowIso,
      } as never,
      { onConflict: "environment" },
    )
    .select("environment,intro_text,video_url,is_published,published_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return toRecord(data as Row);
}
