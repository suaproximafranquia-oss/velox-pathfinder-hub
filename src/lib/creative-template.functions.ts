/**
 * Publicação e remoção do Template Oficial.
 *
 * A gravação passa pelo servidor: o navegador do executivo pode estar
 * com a sessão do banco expirada, e era exatamente isso que produzia o
 * aviso "não pôde ser publicado" mesmo com o arquivo correto. Aqui a
 * identidade é validada uma única vez e a escrita é feita pelo servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const templateSchema = z.object({
  model: z.enum(["institucional", "marketing"]),
  fileName: z.string().min(1),
  contentType: z.string().min(3),
  dataUrl: z.string().min(32),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  config: z.unknown(),
  updatedBy: z.string().optional(),
});

export const publishCreativeTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => templateSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("creative_templates").upsert(
      {
        model: data.model,
        file_name: data.fileName,
        content_type: data.contentType,
        data_url: data.dataUrl,
        width: data.width,
        height: data.height,
        config: data.config as never,
        updated_by: data.updatedBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "model" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Remove o template enviado — o modelo volta ao arquivo embutido. */
export const removeCreativeTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ model: z.enum(["institucional", "marketing"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("creative_templates")
      .delete()
      .eq("model", data.model);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
