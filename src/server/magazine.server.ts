/**
 * REVISTA VELOX + MÓDULOS INSTITUCIONAIS — camada de dados.
 *
 * A leitura pública do Portal e a administração da Revista passam
 * exclusivamente por aqui. As mídias vivem em um acervo privado e são
 * entregues por URL assinada temporária — nunca por link permanente.
 */
import type {
  MagazineEdition,
  MagazinePage,
  MediaKind,
} from "@/lib/magazine/edition";
import { PAGE_BODY_MAX, renumberPages, todayInSaoPaulo } from "@/lib/magazine/edition";

export const MAGAZINE_BUCKET = "revista";
const SIGNED_URL_TTL = 60 * 60 * 6; // 6 horas

export type InstitutionalModule = "estrutura" | "principios";

export type InstitutionalBlock = {
  id: string;
  module: InstitutionalModule;
  position: number;
  eyebrow: string | null;
  title: string;
  body: string;
  mediaKind: MediaKind;
  mediaUrl: string | null;
  active: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Converte `storage://caminho` em URL assinada; demais valores passam direto. */
async function resolveMedia(values: Array<string | null>): Promise<Map<string, string>> {
  const paths = values
    .filter((v): v is string => Boolean(v && v.startsWith("storage://")))
    .map((v) => v.replace("storage://", ""));
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const supabase = await admin();
  const { data } = await supabase.storage
    .from(MAGAZINE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(`storage://${item.path}`, item.signedUrl);
  }
  return map;
}

function publicUrl(raw: string | null, signed: Map<string, string>): string | null {
  if (!raw) return null;
  return raw.startsWith("storage://") ? signed.get(raw) ?? null : raw;
}

/* ------------------------------- Revista -------------------------------- */

export async function listEditions(): Promise<MagazineEdition[]> {
  const supabase = await admin();
  const { data: editions, error } = await supabase
    .from("magazine_editions")
    .select("id,number,title,subtitle,cover_url,starts_on,published,created_by_name,created_at")
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = editions ?? [];
  if (rows.length === 0) return [];

  const { data: pages, error: pagesError } = await supabase
    .from("magazine_pages")
    .select("id,edition_id,position,eyebrow,title,body,caption,media_kind,media_url")
    .in("edition_id", rows.map((r) => String(r.id)))
    .order("position", { ascending: true });
  if (pagesError) throw new Error(pagesError.message);

  const signed = await resolveMedia([
    ...rows.map((r) => (r.cover_url as string | null) ?? null),
    ...(pages ?? []).map((p) => (p.media_url as string | null) ?? null),
  ]);

  const byEdition = new Map<string, MagazinePage[]>();
  for (const page of pages ?? []) {
    const editionId = String(page.edition_id);
    byEdition.set(editionId, [
      ...(byEdition.get(editionId) ?? []),
      {
        id: String(page.id),
        editionId,
        position: Number(page.position ?? 1),
        eyebrow: (page.eyebrow as string | null) ?? null,
        title: String(page.title),
        body: String(page.body ?? ""),
        caption: (page.caption as string | null) ?? null,
        mediaKind: (page.media_kind as MediaKind) ?? "none",
        mediaUrl: publicUrl((page.media_url as string | null) ?? null, signed),
      },
    ]);
  }

  return rows.map((row) => ({
    id: String(row.id),
    number: Number(row.number),
    title: String(row.title),
    subtitle: (row.subtitle as string | null) ?? null,
    coverUrl: publicUrl((row.cover_url as string | null) ?? null, signed),
    startsOn: String(row.starts_on).slice(0, 10),
    published: Boolean(row.published),
    createdByName: String(row.created_by_name ?? "—"),
    createdAt: String(row.created_at),
    pages: byEdition.get(String(row.id)) ?? [],
  }));
}

/** Somente o que o investidor pode ver: edições publicadas. */
export async function listPublishedEditions(): Promise<MagazineEdition[]> {
  return (await listEditions()).filter((e) => e.published);
}

export type EditionInput = {
  id?: string | null;
  number: number;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  startsOn: string;
  published: boolean;
  createdByName: string;
};

export async function saveEdition(input: EditionInput): Promise<MagazineEdition[]> {
  const supabase = await admin();
  const payload = {
    number: input.number,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    cover_url: input.coverUrl || null,
    starts_on: input.startsOn,
    published: input.published,
    created_by_name: input.createdByName,
  };
  if (input.id) {
    const { error } = await supabase
      .from("magazine_editions")
      .update(payload as never)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("magazine_editions").insert(payload as never);
    if (error) throw new Error(error.message);
  }
  return listEditions();
}

/**
 * §10/§11 — a edição NUNCA é excluída. Desativar apenas a oculta do
 * Portal do Investidor, preservando numeração, páginas e histórico.
 */
export async function setEditionPublished(
  id: string,
  published: boolean,
): Promise<MagazineEdition[]> {
  const supabase = await admin();
  const { error } = await supabase
    .from("magazine_editions")
    .update({ published } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return listEditions();
}

export type PageInput = {
  id?: string | null;
  editionId: string;
  /** Opcional: quando ausente, o conteúdo é anexado ao fim da edição. */
  position?: number | null;
  eyebrow?: string | null;
  title: string;
  body: string;
  caption?: string | null;
  mediaKind: MediaKind;
  mediaUrl?: string | null;
};

export async function savePage(input: PageInput): Promise<MagazineEdition[]> {
  const supabase = await admin();
  if (input.body.length > PAGE_BODY_MAX) {
    throw new Error(`O texto da página excede ${PAGE_BODY_MAX} caracteres.`);
  }
  const { count: existing } = await supabase
    .from("magazine_pages")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", input.editionId);
  const payload = {
    edition_id: input.editionId,
    position: input.position ?? (existing ?? 0) + 1,
    eyebrow: input.eyebrow?.trim() || null,
    title: input.title.trim(),
    body: input.body,
    caption: input.caption?.trim() || null,
    media_kind: input.mediaKind,
    media_url: input.mediaUrl || null,
  };
  if (input.id) {
    const { position: _ignored, ...rest } = payload;
    const updatePayload = input.position ? payload : rest;
    const { error } = await supabase
      .from("magazine_pages")
      .update(updatePayload as never)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    // §2 — a contagem dos 10 dias começa no primeiro conteúdo publicado.
    const { error } = await supabase.from("magazine_pages").insert(payload as never);
    if (error) throw new Error(error.message);
    if ((existing ?? 0) === 0) {
      await supabase
        .from("magazine_editions")
        .update({ starts_on: todayInSaoPaulo() } as never)
        .eq("id", input.editionId);
    }
  }
  return reindexEdition(input.editionId);
}

/** Reconstrói a numeração contínua das páginas de uma edição (§15). */
async function reindexEdition(editionId: string): Promise<MagazineEdition[]> {
  const supabase = await admin();
  const editions = await listEditions();
  const edition = editions.find((e) => e.id === editionId);
  if (!edition) return editions;
  const updates = renumberPages(edition.pages).filter((target) => {
    const current = edition.pages.find((p) => p.id === target.id);
    return current && current.position !== target.position;
  });
  if (updates.length === 0) return editions;
  for (const update of updates) {
    await supabase
      .from("magazine_pages")
      .update({ position: update.position } as never)
      .eq("id", update.id);
  }
  return listEditions();
}

/**
 * §6/§14 — o conteúdo é um PAR indivisível (texto + mídia). Excluir o
 * conteúdo remove o par inteiro e a numeração é reconstruída.
 */
export async function deletePagePair(id: string): Promise<MagazineEdition[]> {
  const supabase = await admin();
  const { data: row } = await supabase
    .from("magazine_pages")
    .select("edition_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("magazine_pages").delete().eq("id", id);
  if (error) throw new Error(error.message);
  const editionId = row ? String((row as { edition_id: string }).edition_id) : null;
  return editionId ? reindexEdition(editionId) : listEditions();
}

/* --------------------------- Módulos institucionais --------------------------- */

export async function listInstitutionalBlocks(
  module?: InstitutionalModule,
): Promise<InstitutionalBlock[]> {
  const supabase = await admin();
  let query = supabase
    .from("portal_institutional_blocks")
    .select("id,module,position,eyebrow,title,body,media_kind,media_url,active")
    .order("position", { ascending: true });
  if (module) query = query.eq("module", module);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const signed = await resolveMedia(rows.map((r) => (r.media_url as string | null) ?? null));
  return rows.map((row) => ({
    id: String(row.id),
    module: row.module as InstitutionalModule,
    position: Number(row.position ?? 1),
    eyebrow: (row.eyebrow as string | null) ?? null,
    title: String(row.title),
    body: String(row.body ?? ""),
    mediaKind: (row.media_kind as MediaKind) ?? "none",
    mediaUrl: publicUrl((row.media_url as string | null) ?? null, signed),
    active: Boolean(row.active),
  }));
}

export type BlockInput = {
  id?: string | null;
  module: InstitutionalModule;
  position: number;
  eyebrow?: string | null;
  title: string;
  body: string;
  mediaKind: MediaKind;
  mediaUrl?: string | null;
  active: boolean;
};

export async function saveInstitutionalBlock(input: BlockInput): Promise<InstitutionalBlock[]> {
  const supabase = await admin();
  const payload = {
    module: input.module,
    position: input.position,
    eyebrow: input.eyebrow?.trim() || null,
    title: input.title.trim(),
    body: input.body,
    media_kind: input.mediaKind,
    media_url: input.mediaUrl || null,
    active: input.active,
  };
  if (input.id) {
    const { error } = await supabase
      .from("portal_institutional_blocks")
      .update(payload as never)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("portal_institutional_blocks")
      .insert(payload as never);
    if (error) throw new Error(error.message);
  }
  return listInstitutionalBlocks();
}

export async function deleteInstitutionalBlock(id: string): Promise<InstitutionalBlock[]> {
  const supabase = await admin();
  const { error } = await supabase.from("portal_institutional_blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return listInstitutionalBlocks();
}

/* --------------------------------- Mídias --------------------------------- */

export async function uploadMagazineMedia(input: {
  fileName: string;
  mimeType: string;
  base64: string;
}): Promise<{ reference: string }> {
  const clean = input.base64.includes(",") ? input.base64.split(",")[1]! : input.base64;
  const bytes = Buffer.from(clean, "base64");
  if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
  const safe = input.fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `revista/${crypto.randomUUID()}-${safe}`;
  const supabase = await admin();
  const { error } = await supabase.storage
    .from(MAGAZINE_BUCKET)
    .upload(path, bytes, {
      contentType: input.mimeType || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return { reference: `storage://${path}` };
}
