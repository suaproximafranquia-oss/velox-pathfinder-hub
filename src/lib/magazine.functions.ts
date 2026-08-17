/**
 * REVISTA VELOX — funções de servidor.
 *
 * Leitura pública (Portal do Investidor): sem autenticação, devolve
 * apenas edições publicadas e blocos institucionais ativos — nenhum
 * dado pessoal trafega. Administração: exige sessão autenticada do
 * Workspace.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MagazineEdition } from "@/lib/magazine/edition";
import type { InstitutionalBlock, InstitutionalModule } from "@/server/magazine.server";

const mediaKind = z.enum(["none", "imagem", "video"]);
const moduleKey = z.enum(["estrutura", "principios"]);

/* ------------------------------ leitura pública ------------------------------ */

export const fetchPortalMagazine = createServerFn({ method: "POST" }).handler(
  async (): Promise<MagazineEdition[]> => {
    const { listPublishedEditions } = await import("@/server/magazine.server");
    return listPublishedEditions();
  },
);

export const fetchInstitutionalModule = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ module: moduleKey }).parse(data))
  .handler(async ({ data }): Promise<InstitutionalBlock[]> => {
    const { listInstitutionalBlocks } = await import("@/server/magazine.server");
    const blocks = await listInstitutionalBlocks(data.module as InstitutionalModule);
    return blocks.filter((block) => block.active);
  });

/* ------------------------------- administração ------------------------------- */

export const listMagazineEditions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<MagazineEdition[]> => {
    const { listEditions } = await import("@/server/magazine.server");
    return listEditions();
  });

export const saveMagazineEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        number: z.number().int().min(1),
        title: z.string().min(2),
        subtitle: z.string().nullable().optional(),
        coverUrl: z.string().nullable().optional(),
        startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        published: z.boolean(),
        createdByName: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<MagazineEdition[]> => {
    const { saveEdition } = await import("@/server/magazine.server");
    return saveEdition(data);
  });

/** Edição nunca é excluída: apenas ativada/desativada no Portal. */
export const setMagazineEditionPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(data),
  )
  .handler(async ({ data }): Promise<MagazineEdition[]> => {
    const { setEditionPublished } = await import("@/server/magazine.server");
    return setEditionPublished(data.id, data.published);
  });

export const saveMagazinePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        editionId: z.string().uuid(),
        position: z.number().int().min(1),
        eyebrow: z.string().nullable().optional(),
        title: z.string().min(2),
        body: z.string().max(900),
        caption: z.string().nullable().optional(),
        mediaKind,
        mediaUrl: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<MagazineEdition[]> => {
    const { savePage } = await import("@/server/magazine.server");
    return savePage(data);
  });

/** Exclui o CONTEÚDO inteiro (texto + mídia) e renumera a edição. */
export const deleteMagazinePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<MagazineEdition[]> => {
    const { deletePagePair } = await import("@/server/magazine.server");
    return deletePagePair(data.id);
  });

export const listInstitutionalContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<InstitutionalBlock[]> => {
    const { listInstitutionalBlocks } = await import("@/server/magazine.server");
    return listInstitutionalBlocks();
  });

export const saveInstitutionalContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        module: moduleKey,
        position: z.number().int().min(1),
        eyebrow: z.string().nullable().optional(),
        title: z.string().min(2),
        body: z.string(),
        mediaKind,
        mediaUrl: z.string().nullable().optional(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<InstitutionalBlock[]> => {
    const { saveInstitutionalBlock } = await import("@/server/magazine.server");
    return saveInstitutionalBlock(data);
  });

export const deleteInstitutionalContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<InstitutionalBlock[]> => {
    const { deleteInstitutionalBlock } = await import("@/server/magazine.server");
    return deleteInstitutionalBlock(data.id);
  });

export const uploadMagazineFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        base64: z.string().min(10),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ reference: string }> => {
    const { uploadMagazineMedia } = await import("@/server/magazine.server");
    return uploadMagazineMedia(data);
  });
