import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CreativeCopyInput = {
  city: string;
  state: string;
  /** Nome institucional derivado da cidade — nunca digitado manualmente. */
  unit?: string;
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

/** Fotografia institucional da cidade informada (Cidade + UF). */
export const getCityPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { city: string; state: string }) => data)
  .handler(async ({ data }): Promise<{ dataUrl: string | null; credit: string | null }> => {
    const { findCityPhoto } = await import("@/server/creative-photo.server");
    return findCityPhoto(data.city, data.state);
  });

/** Arquiva automaticamente a arte gerada na pasta corporativa oficial. */
export const saveCreativeArt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { name: string; contentBase64: string; mimeType?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { saveToCorporateFolder } = await import("@/server/google-drive.server");
    return saveToCorporateFolder(context.userId, {
      name: data.name,
      mimeType: data.mimeType || "image/png",
      contentBase64: data.contentBase64,
    });
  });

/**
 * MODELO OFICIAL — arquivo único. Um novo envio substitui o anterior;
 * nunca existem versões nem histórico.
 */
export const saveOfficialModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { name: string; contentBase64: string; mimeType?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { replaceOfficialModel } = await import("@/server/google-drive.server");
    return replaceOfficialModel(context.userId, {
      name: data.name,
      mimeType: data.mimeType || "application/octet-stream",
      contentBase64: data.contentBase64,
    });
  });