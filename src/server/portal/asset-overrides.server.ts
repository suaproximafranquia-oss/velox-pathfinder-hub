/**
 * IMAGENS DO PORTAL — camada de dados das substituições.
 *
 * Cada linha diz: "neste espaço do Portal desta unidade, mostre esta
 * imagem". A imagem original permanece intocada no projeto: apagar a
 * linha devolve o original. O acervo é o mesmo já usado pela Revista
 * (privado, entregue por URL assinada temporária).
 */
import { MAGAZINE_BUCKET } from "@/server/magazine.server";

const SIGNED_URL_TTL = 60 * 60 * 6; // 6 horas

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Substituições da unidade, já resolvidas em URL exibível. */
export async function listPortalAssetOverrides(unit: string): Promise<Record<string, string>> {
  const supabase = await admin();
  const { data } = await supabase
    .from("portal_asset_overrides")
    .select("asset_key, reference")
    .eq("unit", unit);
  const rows = (data ?? []) as Array<{ asset_key: string; reference: string }>;
  if (rows.length === 0) return {};

  const paths = rows
    .map((r) => r.reference)
    .filter((r) => r.startsWith("storage://"))
    .map((r) => r.replace("storage://", ""));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from(MAGAZINE_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const item of urls ?? []) {
      if (item.path && item.signedUrl) signed.set(`storage://${item.path}`, item.signedUrl);
    }
  }

  const out: Record<string, string> = {};
  for (const row of rows) {
    const url = row.reference.startsWith("storage://")
      ? signed.get(row.reference)
      : row.reference;
    if (url) out[row.asset_key] = url;
  }
  return out;
}

/** Envia o arquivo e grava a substituição do espaço. */
export async function savePortalAssetOverride(input: {
  unit: string;
  assetKey: string;
  fileName: string;
  mimeType: string;
  base64: string;
  userId: string;
}): Promise<{ url: string }> {
  const clean = input.base64.includes(",") ? input.base64.split(",")[1]! : input.base64;
  const bytes = Buffer.from(clean, "base64");
  if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
  const safe = input.fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `portal/${input.unit}/${input.assetKey}/${crypto.randomUUID()}-${safe}`;

  const supabase = await admin();
  const { error: upErr } = await supabase.storage.from(MAGAZINE_BUCKET).upload(path, bytes, {
    contentType: input.mimeType || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  const { error } = await supabase
    .from("portal_asset_overrides")
    .upsert(
      {
        unit: input.unit,
        asset_key: input.assetKey,
        reference: `storage://${path}`,
        updated_by: input.userId,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "unit,asset_key" },
    );
  if (error) throw new Error(error.message);

  const { data } = await supabase.storage
    .from(MAGAZINE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return { url: data?.signedUrl ?? "" };
}

/** Remove a substituição — o Portal volta a exibir a imagem original. */
export async function removePortalAssetOverride(unit: string, assetKey: string): Promise<void> {
  const supabase = await admin();
  const { error } = await supabase
    .from("portal_asset_overrides")
    .delete()
    .eq("unit", unit)
    .eq("asset_key", assetKey);
  if (error) throw new Error(error.message);
}
