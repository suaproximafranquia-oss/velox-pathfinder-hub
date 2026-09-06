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

/**
 * Grava a apresentação vigente do ambiente — uma linha por ambiente, sempre.
 *
 * Segurança contra falha parcial: a vigente atual é lida primeiro, o upsert
 * acontece em seguida e SÓ DEPOIS a anterior é arquivada. Se o upsert falhar,
 * nada foi arquivado e o ambiente continua com a apresentação anterior. Se o
 * arquivamento falhar, a linha anterior é restaurada (reversão) e o erro sobe.
 */
export async function saveEnvironmentPresentation(params: {
  environment: string;
  introText: string;
  videoUrl: string;
  isPublished: boolean;
  actorId: string | null;
}): Promise<EnvironmentPresentation> {
  const nowIso = new Date().toISOString();

  const { data: previousData, error: previousError } = await supabaseAdmin
    .from("environment_presentations")
    .select("environment,intro_text,video_url,is_published,published_at,updated_by,updated_by_name")
    .eq("environment", params.environment)
    .maybeSingle();
  if (previousError) throw new Error(previousError.message);
  const previous = previousData as
    | (Row & { updated_by: string | null; updated_by_name: string | null })
    | null;

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

  if (previous) {
    const { error: historyError } = await supabaseAdmin
      .from("environment_presentations_history")
      .insert({
        environment: previous.environment,
        intro_text: previous.intro_text,
        video_url: previous.video_url,
        is_published: previous.is_published ?? false,
        published_at: previous.published_at,
        updated_by: previous.updated_by,
        updated_by_name: previous.updated_by_name,
        archived_at: nowIso,
      } as never);
    if (historyError) {
      // Reversão: devolve o ambiente exatamente ao estado anterior.
      await supabaseAdmin
        .from("environment_presentations")
        .update({
          intro_text: previous.intro_text,
          video_url: previous.video_url,
          is_published: previous.is_published ?? false,
          published_at: previous.published_at,
          updated_at: nowIso,
        } as never)
        .eq("environment", params.environment);
      throw new Error(
        `Falha ao arquivar a apresentação anterior; a publicação foi revertida. ${historyError.message}`,
      );
    }
  }

  return toRecord(data as Row);
}

