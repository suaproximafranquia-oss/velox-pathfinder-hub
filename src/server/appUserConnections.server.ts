/** Persistência das conexões Google por usuário autenticado — SERVER ONLY. */
import { decryptConnectionKey, encryptConnectionKey } from "@/server/connectionKeyCrypto";

export type StoredConnection = {
  connectorId: string;
  accountEmail: string | null;
  updatedAt: string;
};

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
  accountEmail?: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      account_email: accountEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function setConnectionAccountEmail(
  userId: string,
  connectorId: string,
  accountEmail: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("app_user_connections")
    .update({ account_email: accountEmail, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

export async function getConnectionKeyForUser(
  userId: string,
  connectorId: string,
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function listConnectionsForUser(userId: string): Promise<StoredConnection[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("connector_id, account_email, updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    connectorId: row.connector_id as string,
    accountEmail: (row.account_email as string | null) ?? null,
    updatedAt: row.updated_at as string,
  }));
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

/**
 * A Conta Google é do PORTAL, não do executivo: qualquer credencial
 * existente para o conector vale para todos os usuários autenticados.
 */
export async function findAnyConnection(
  connectorId: string,
): Promise<{ userId: string; key: string; accountEmail: string | null; updatedAt: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("user_id, connection_key_ciphertext, account_email, updated_at")
    .eq("connector_id", connectorId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    userId: row.user_id as string,
    key: decryptConnectionKey(row.connection_key_ciphertext as string),
    accountEmail: (row.account_email as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

/** Move uma credencial individual antiga para o proprietário corporativo. */
export async function promoteConnectionToOwner(
  fromUserId: string,
  toUserId: string,
  connectorId: string,
) {
  if (fromUserId === toUserId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("app_user_connections")
    .update({ user_id: toUserId, updated_at: new Date().toISOString() })
    .eq("user_id", fromUserId)
    .eq("connector_id", connectorId);
}