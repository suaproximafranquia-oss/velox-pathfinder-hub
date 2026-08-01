import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Link oficial da pasta corporativa fixa no Drive da Conta Google do
 * Portal — nunca o Drive da conta logada no navegador e nunca uma
 * pasta nova.
 */
export const getCorporateDriveLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data ?? {})
  .handler(async (): Promise<{ url: string | null }> => {
    const { CORPORATE_FOLDER_ID } = await import("@/server/google-drive.server");
    return { url: `https://drive.google.com/drive/folders/${CORPORATE_FOLDER_ID}` };
  });

/** Cria (ou reaproveita) a pasta do investidor dentro de "Portal Velox". */
export const ensureInvestorDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { investorName: string }) => data)
  .handler(async ({ data, context }) => {
    const { ensureInvestorFolder } = await import("@/server/google-drive.server");
    return ensureInvestorFolder(context.userId, data.investorName);
  });

/** Envia um documento (PDF, imagem, planilha) para a pasta do investidor. */
export const uploadInvestorDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      investorName: string;
      name: string;
      mimeType: string;
      contentBase64: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { ensureInvestorFolder, uploadDocument } = await import("@/server/google-drive.server");
    const { folderId } = await ensureInvestorFolder(context.userId, data.investorName);
    return uploadDocument(context.userId, {
      folderId,
      name: data.name,
      mimeType: data.mimeType,
      contentBase64: data.contentBase64,
    });
  });