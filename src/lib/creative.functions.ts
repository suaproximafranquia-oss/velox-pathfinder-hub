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
 * IA Criativa — produz apenas os TEXTOS do Modelo B (Marketing).
 * O Modelo A é preenchimento do Template Oficial e não usa IA de texto.
 */
export const generateCreativeCopy = createServerFn({ method: "POST" })
  .inputValidator((data: CreativeCopyInput) => data)
  .handler(async ({ data }): Promise<CreativeCopyPair> => {
    const { buildCreativeCopy } = await import("@/server/creative.server");
    return buildCreativeCopy(data);
  });

/** Fotografia representativa da cidade informada (Cidade + UF). */
export const getCityPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { city: string; state: string }) => data)
  .handler(
    async ({ data }): Promise<{ dataUrl: string | null; credit: string | null }> => {
      const { resolveCityPhoto } = await import("@/server/creative-photo.server");
      return resolveCityPhoto(data.city, data.state).catch(() => ({
        dataUrl: null,
        credit: null,
      }));
    },
  );

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
