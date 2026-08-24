import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Vídeo de pós-apresentação individual do executivo.
 *
 * O arquivo vai para o bucket privado da biblioteca e volta como link
 * assinado de longa duração — o executivo não precisa hospedar o vídeo
 * em serviço externo nem colar URL manualmente.
 */
const BUCKET = "biblioteca-conteudos";
const TEN_YEARS_S = 10 * 365 * 24 * 60 * 60;

export const uploadPostPresentationVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        executiveId: z.string().min(2).max(80),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().max(160).default("video/mp4"),
        base64: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clean = data.base64.includes(",") ? data.base64.split(",")[1]! : data.base64;
    const bytes = Buffer.from(clean, "base64");
    if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
    if (bytes.byteLength > 200 * 1024 * 1024) throw new Error("Vídeo acima de 200 MB.");
    const safe = data.fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `executivos/${data.executiveId}/pos-apresentacao-${Date.now()}-${safe}`;
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.mimeType || "video/mp4", upsert: true });
    if (up.error) throw new Error(up.error.message);
    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS_S);
    if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Falha ao gerar link.");
    return { url: signed.data.signedUrl };
  });
