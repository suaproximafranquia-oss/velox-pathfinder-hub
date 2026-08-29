/**
 * APRESENTAÇÃO DIGITAL — ROTEIRO ADMINISTRÁVEL (SERVER ONLY).
 *
 * A área administrativa cadastra CAPÍTULOS (vídeos). Nada é apagado
 * fisicamente: editar publica uma NOVA VERSÃO do mesmo `chapter_key` e a
 * versão anterior continua no banco, preservando as apresentações já
 * congeladas.
 *
 * O roteiro vigente (`currentScript`) é o que a E20 congela no momento
 * da emissão — apresentações antigas continuam exibindo o snapshot que
 * receberam, nunca o roteiro atual.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PresentationChapter = {
  id: string;
  chapterKey: string;
  version: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
  /** Rascunho NUNCA entra em uma emissão — só o publicado é congelado. */
  isDraft: boolean;
  publishedAt: string | null;
  publishedByName: string | null;
};

/** Item congelado no snapshot — formato estável para reprodução. */
export type PresentationScriptItem = {
  chapterKey: string;
  version: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  order: number;
};

export type PresentationScript = {
  frozenAt: string;
  items: PresentationScriptItem[];
};

function toChapter(row: Record<string, any>): PresentationChapter {
  return {
    id: row["id"],
    chapterKey: row["chapter_key"],
    version: Number(row["version"] ?? 1),
    title: row["title"],
    description: row["description"] ?? null,
    videoUrl: row["video_url"] ?? null,
    thumbnailUrl: row["thumbnail_url"] ?? null,
    sortOrder: Number(row["sort_order"] ?? 0),
    isActive: row["is_active"] !== false,
    updatedAt: row["updated_at"] ?? row["created_at"],
    isDraft: row["is_draft"] === true,
    publishedAt: row["published_at"] ?? null,
    publishedByName: row["published_by_name"] ?? null,
  };
}

/** Capítulos PUBLICADOS vigentes (última versão de cada chapter_key). */
export async function listCurrentChapters(): Promise<PresentationChapter[]> {
  const { data, error } = await supabaseAdmin
    .from("presentation_chapters")
    .select("*")
    .eq("is_current", true)
    .eq("is_draft", false)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toChapter);
}

/**
 * RASCUNHOS: última versão de um capítulo que ainda não foi publicada.
 * Aparecem só na administração e na pré-visualização — nunca em uma E20.
 */
export async function listDraftChapters(): Promise<PresentationChapter[]> {
  const { data } = await supabaseAdmin
    .from("presentation_chapters")
    .select("*")
    .order("version", { ascending: false });
  const latestByKey = new Map<string, Record<string, any>>();
  for (const row of (data ?? []) as Record<string, any>[]) {
    const key = String(row["chapter_key"]);
    if (!latestByKey.has(key)) latestByKey.set(key, row);
  }
  return [...latestByKey.values()]
    .filter((row) => row["is_draft"] === true)
    .map(toChapter)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Histórico completo de um capítulo — nenhuma versão é descartada. */
export async function listChapterVersions(chapterKey: string): Promise<PresentationChapter[]> {
  const { data } = await supabaseAdmin
    .from("presentation_chapters")
    .select("*")
    .eq("chapter_key", chapterKey)
    .order("version", { ascending: false });
  return (data ?? []).map(toChapter);
}

/**
 * Cria ou atualiza um capítulo. Atualizar = publicar nova versão; a
 * versão anterior deixa de ser vigente, mas continua existindo.
 */
export async function saveChapter(params: {
  chapterKey?: string | null;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** false = salvar rascunho; true = publicar nova versão. */
  publish: boolean;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<PresentationChapter[]> {
  const title = params.title.trim();
  if (!title) throw new Error("Título obrigatório.");

  const key = params.chapterKey?.trim() || crypto.randomUUID();

  const { data: previous } = await supabaseAdmin
    .from("presentation_chapters")
    .select("version")
    .eq("chapter_key", key)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Number((previous as any)?.version ?? 0) + 1;
  const at = new Date().toISOString();

  /**
   * IMUTABILIDADE: nenhuma versão publicada é alterada. Publicar cria
   * uma versão nova e apenas transfere a condição de "vigente".
   */
  if (previous && params.publish) {
    await supabaseAdmin
      .from("presentation_chapters")
      .update({ is_current: false } as any)
      .eq("chapter_key", key);
  }

  const { error } = await supabaseAdmin.from("presentation_chapters").insert({
    chapter_key: key,
    version: nextVersion,
    is_current: params.publish,
    is_draft: !params.publish,
    is_active: params.isActive,
    title,
    description: params.description,
    video_url: params.videoUrl,
    thumbnail_url: params.thumbnailUrl,
    sort_order: params.sortOrder,
    created_by: params.actorId ?? null,
    created_by_name: params.actorName ?? null,
    published_at: params.publish ? at : null,
    published_by: params.publish ? (params.actorId ?? null) : null,
    published_by_name: params.publish ? (params.actorName ?? null) : null,
  } as any);
  if (error) throw new Error(error.message);

  return listCurrentChapters();
}

/** Publica o rascunho mais recente de um capítulo. */
export async function publishDraft(params: {
  chapterKey: string;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<PresentationChapter[]> {
  const { data: draft } = await supabaseAdmin
    .from("presentation_chapters")
    .select("*")
    .eq("chapter_key", params.chapterKey)
    .eq("is_draft", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) throw new Error("Não há rascunho para publicar neste capítulo.");

  const at = new Date().toISOString();
  await supabaseAdmin
    .from("presentation_chapters")
    .update({ is_current: false } as any)
    .eq("chapter_key", params.chapterKey);

  await supabaseAdmin
    .from("presentation_chapters")
    .update({
      is_draft: false,
      is_current: true,
      published_at: at,
      published_by: params.actorId ?? null,
      published_by_name: params.actorName ?? null,
      updated_at: at,
    } as any)
    .eq("id", (draft as any).id);

  return listCurrentChapters();
}

/** Ativa/desativa sem apagar: o capítulo sai apenas de NOVAS emissões. */
export async function setChapterActive(
  chapterKey: string,
  active: boolean,
): Promise<PresentationChapter[]> {
  await supabaseAdmin
    .from("presentation_chapters")
    .update({ is_active: active, updated_at: new Date().toISOString() } as any)
    .eq("chapter_key", chapterKey)
    .eq("is_current", true)
    .eq("is_draft", false);
  return listCurrentChapters();
}

/** Reordenação explícita (arrastar para cima/baixo na administração). */
export async function reorderChapters(order: string[]): Promise<PresentationChapter[]> {
  let index = 0;
  for (const key of order) {
    await supabaseAdmin
      .from("presentation_chapters")
      .update({ sort_order: index, updated_at: new Date().toISOString() } as any)
      .eq("chapter_key", key)
      .eq("is_current", true)
      .eq("is_draft", false);
    index += 1;
  }
  return listCurrentChapters();
}

/**
 * Roteiro que será congelado: somente capítulos PUBLICADOS e ativos.
 * Rascunho não entra em emissão nenhuma.
 */
export async function currentScript(): Promise<PresentationScript> {
  const chapters = (await listCurrentChapters()).filter((c) => c.isActive);
  return {
    frozenAt: new Date().toISOString(),
    items: chapters.map((c, index) => ({
      chapterKey: c.chapterKey,
      version: c.version,
      title: c.title,
      description: c.description,
      videoUrl: c.videoUrl,
      thumbnailUrl: c.thumbnailUrl,
      order: index,
    })),
  };
}

/** Leitura defensiva do snapshot gravado na ocorrência da E20. */
export function scriptFromSnapshot(snapshot: unknown): PresentationScript | null {
  const raw = (snapshot as Record<string, any> | null)?.["roteiro"];
  if (!raw || !Array.isArray(raw.items)) return null;
  return {
    frozenAt: String(raw.frozenAt ?? ""),
    items: raw.items as PresentationScriptItem[],
  };
}
