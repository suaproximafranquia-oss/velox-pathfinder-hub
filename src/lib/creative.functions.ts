import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CreativeCopyInput = {
  unit: string;
  city: string;
  state: string;
  address?: string;
  openingDate?: string;
  phone?: string;
  notes?: string;
};

export type CreativeCopy = {
  headline: string;
  subheadline: string;
  supporting: string;
};

export type CreativeCopyPair = {
  institucional: CreativeCopy;
  marketing: CreativeCopy;
};

/**
 * IA Criativa — produz apenas os TEXTOS oficiais das peças.
 * A identidade visual é imutável e vem dos templates oficiais.
 */
export const generateCreativeCopy = createServerFn({ method: "POST" })
  .inputValidator((data: CreativeCopyInput) => data)
  .handler(async ({ data }): Promise<CreativeCopyPair> => {
    const { buildCreativeCopy } = await import("@/server/creative.server");
    return buildCreativeCopy(data);
  });

/** Garante a biblioteca oficial da IA Criativa no Drive corporativo. */
export const ensureCreativeLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data ?? {})
  .handler(async ({ context }) => {
    const { ensureCreativeFolders } = await import("@/server/google-drive.server");
    return ensureCreativeFolders(context.userId);
  });

/** Salva (sem duplicar) uma arte gerada na pasta oficial "Artes geradas". */
export const saveCreativeArt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { name: string; contentBase64: string; mimeType?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { ensureCreativeFolders, uploadUniqueDocument } = await import(
      "@/server/google-drive.server"
    );
    const folders = await ensureCreativeFolders(context.userId);
    return uploadUniqueDocument(context.userId, {
      folderId: folders.generatedId,
      name: data.name,
      mimeType: data.mimeType || "image/png",
      contentBase64: data.contentBase64,
    });
  });