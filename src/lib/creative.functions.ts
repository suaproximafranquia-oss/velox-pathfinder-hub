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

export type OfficialArt = { model: "institucional" | "marketing"; base64: string };

/**
 * Gera as DUAS artes oficiais a partir do Modelo Oficial enviado pelo
 * administrador — Modelo A (fiel) e Modelo B (criativo).
 */
export const generateOfficialArts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { city: string; state: string }) => data)
  .handler(async ({ data, context }): Promise<{ arts: OfficialArt[] }> => {
    const { data: row, error } = await context.supabase
      .from("creative_official_model")
      .select("mime_type, content_base64")
      .eq("id", "official")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      throw new Error(
        "Nenhum Modelo Oficial foi enviado. Envie a arte oficial antes de gerar as peças.",
      );
    }
    if (!String(row.mime_type).startsWith("image/")) {
      throw new Error(
        "O Modelo Oficial precisa ser uma imagem (PNG ou JPG) para que a IA possa reproduzi-lo.",
      );
    }
    const { buildOfficialArts } = await import("@/server/creative-art.server");
    const result = await buildOfficialArts({
      city: data.city,
      state: data.state,
      officialDataUrl: `data:${row.mime_type};base64,${row.content_base64}`,
    });
    return { arts: result.arts };
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
 *
 * A persistência é feita no banco corporativo (fonte da verdade), de modo
 * que o arquivo permanece salvo mesmo sem a Conta Google conectada. O
 * envio ao Drive é complementar e nunca invalida o upload.
 */
export const saveOfficialModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { name: string; contentBase64: string; mimeType?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mimeType = data.mimeType || "application/octet-stream";
    const uploadedAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from("creative_official_model").upsert(
      {
        id: "official",
        file_name: data.name,
        mime_type: mimeType,
        content_base64: data.contentBase64,
        uploaded_by: context.userId,
        uploaded_at: uploadedAt,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);

    // Cópia no Drive corporativo — complementar, jamais bloqueante.
    let driveLink: string | null = null;
    try {
      const { replaceOfficialModel } = await import("@/server/google-drive.server");
      const saved = await replaceOfficialModel(context.userId, {
        name: data.name,
        mimeType,
        contentBase64: data.contentBase64,
      });
      driveLink = saved.webViewLink ?? null;
    } catch {
      /* Drive indisponível — o Modelo Oficial já está salvo no banco. */
    }
    return { fileName: data.name, mimeType, uploadedAt, driveLink };
  });

/** Modelo Oficial vigente — metadados (o conteúdo é devolvido sob demanda). */
export const getOfficialModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { withContent?: boolean }) => data ?? {})
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      fileName: string;
      mimeType: string;
      uploadedAt: string;
      contentBase64?: string;
    } | null> => {
      const { data: row, error } = await context.supabase
        .from("creative_official_model")
        .select("file_name, mime_type, uploaded_at, content_base64")
        .eq("id", "official")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return null;
      return {
        fileName: row.file_name,
        mimeType: row.mime_type,
        uploadedAt: row.uploaded_at,
        ...(data.withContent ? { contentBase64: row.content_base64 } : {}),
      };
    },
  );