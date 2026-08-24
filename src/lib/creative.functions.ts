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
  .inputValidator((data: { city: string; state: string; exclude?: string[] }) => data)
  .handler(async ({ data }): Promise<{ dataUrl: string | null; credit: string | null }> => {
    const { resolveCityPhoto } = await import("@/server/creative-photo.server");
    return resolveCityPhoto(data.city, data.state, data.exclude ?? []).catch(() => ({
      dataUrl: null,
      credit: null,
    }));
  });

  });
