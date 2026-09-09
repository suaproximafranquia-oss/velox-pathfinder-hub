/**
 * IMAGENS DO PORTAL — ponte com o servidor.
 *
 * Leitura: pública (o Portal é público). Gravação e remoção: exigem
 * usuário autenticado e autorização do servidor — o navegador nunca
 * decide quem pode editar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const unitSchema = z.string().min(1).max(30);

export const fetchPortalAssetOverrides = createServerFn({ method: "GET" })
  .inputValidator((data: { unit: string }) => z.object({ unit: unitSchema }).parse(data))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { listPortalAssetOverrides } = await import("@/server/portal/asset-overrides.server");
    return listPortalAssetOverrides(data.unit);
  });

/** O servidor responde se o usuário atual pode abrir o modo editor. */
export const canEditPortalAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ allowed: boolean }> => {
    const { canAccessWorkspaceResource } = await import(
      "@/server/workspace-authorization.server"
    );
    try {
      return { allowed: await canAccessWorkspaceResource(context as never, "revista") };
    } catch {
      return { allowed: false };
    }
  });

export const savePortalAssetOverrideFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    unit: string;
    assetKey: string;
    fileName: string;
    mimeType: string;
    base64: string;
  }) =>
    z
      .object({
        unit: unitSchema,
        assetKey: z.string().min(1).max(60),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        base64: z.string().min(10),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { assertWorkspaceAccess } = await import("@/server/workspace-authorization.server");
    await assertWorkspaceAccess(context as never, "revista");
    const { savePortalAssetOverride } = await import("@/server/portal/asset-overrides.server");
    return savePortalAssetOverride({
      ...data,
      userId: (context as { userId: string }).userId,
    });
  });

export const removePortalAssetOverrideFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { unit: string; assetKey: string }) =>
    z.object({ unit: unitSchema, assetKey: z.string().min(1).max(60) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertWorkspaceAccess } = await import("@/server/workspace-authorization.server");
    await assertWorkspaceAccess(context as never, "revista");
    const { removePortalAssetOverride } = await import("@/server/portal/asset-overrides.server");
    await removePortalAssetOverride(data.unit, data.assetKey);
    return { ok: true };
  });
