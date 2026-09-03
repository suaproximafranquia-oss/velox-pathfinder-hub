/**
 * Conexões do Green Sales — SERVER ONLY.
 *
 * A conexão deixa de ser um recurso global do Portal e passa a pertencer
 * ao Executivo autenticado. As credenciais nunca trafegam para o
 * navegador: ficam cifradas no banco e só são abertas aqui dentro.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptConnectionKey, encryptConnectionKey } from "@/server/connectionKeyCrypto";

export const GREENSALES_PROVIDER = "greensales";

export type GreenSalesCredentials = { email: string; password: string };

export type CrmConnectionView = {
  connected: boolean;
  owner: string | null;
  accountEmail: string | null;
  status: string;
  lastVerifiedAt: string | null;
  /** A conexão pertence ao usuário autenticado? */
  mine: boolean;
};

function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(user.length - 2, 2))}@${domain}`;
}

export async function loadConnection(userId: string) {
  const { data } = await supabaseAdmin
    .from("crm_connections")
    .select("user_id,account_label,account_email,credentials_ciphertext,status,last_verified_at")
    .eq("user_id", userId)
    .eq("provider", GREENSALES_PROVIDER)
    .maybeSingle();
  return data ?? null;
}

export async function viewConnection(userId: string, ownerName: string): Promise<CrmConnectionView> {
  const row = await loadConnection(userId);
  if (!row) {
    return {
      connected: false,
      owner: null,
      accountEmail: null,
      status: "DESCONECTADA",
      lastVerifiedAt: null,
      mine: false,
    };
  }
  return {
    connected: row.status === "ATIVA",
    owner: row.account_label ?? ownerName,
    accountEmail: row.account_email ? maskEmail(row.account_email) : null,
    status: row.status,
    lastVerifiedAt: row.last_verified_at,
    mine: true,
  };
}

export async function saveConnection(params: {
  userId: string;
  ownerName: string;
  credentials: GreenSalesCredentials;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("crm_connections").upsert(
    {
      user_id: params.userId,
      provider: GREENSALES_PROVIDER,
      account_label: params.ownerName,
      account_email: params.credentials.email,
      credentials_ciphertext: encryptConnectionKey(JSON.stringify(params.credentials)),
      status: "ATIVA",
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function removeConnection(userId: string): Promise<void> {
  await supabaseAdmin
    .from("crm_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", GREENSALES_PROVIDER);
}

/**
 * Credenciais efetivas de uma operação.
 *
 * 1) conexão do próprio usuário; 2) qualquer conexão ativa (execuções
 * automáticas do agendador); 3) credenciais corporativas do servidor.
 */
export type GreenSalesConnectionContext = {
  credentials: GreenSalesCredentials;
  /** Dono da conexão utilizada — identidade preservada até o card. */
  ownerUserId: string | null;
};

export async function resolveCredentials(
  userId?: string | null,
): Promise<GreenSalesCredentials | null> {
  return (await resolveConnectionContext(userId))?.credentials ?? null;
}

/**
 * Mesma resolução de credenciais, PRESERVANDO o usuário dono da conexão.
 * É esse usuário que permite atribuir o executivo responsável do card no
 * servidor, sem inventar responsável quando não houver identidade.
 */
export async function resolveConnectionContext(
  userId?: string | null,
): Promise<GreenSalesConnectionContext | null> {
  const open = (cipher: string | null): GreenSalesCredentials | null => {
    if (!cipher) return null;
    try {
      const parsed = JSON.parse(decryptConnectionKey(cipher)) as GreenSalesCredentials;
      return parsed.email && parsed.password ? parsed : null;
    } catch {
      return null;
    }
  };

  if (userId) {
    const own = await loadConnection(userId);
    if (own?.status === "ATIVA") {
      const creds = open(own.credentials_ciphertext);
      if (creds) return { credentials: creds, ownerUserId: userId };
    }
  }

  const { data: any_ } = await supabaseAdmin
    .from("crm_connections")
    .select("user_id,credentials_ciphertext")
    .eq("provider", GREENSALES_PROVIDER)
    .eq("status", "ATIVA")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const shared = open(any_?.credentials_ciphertext ?? null);
  if (shared) return { credentials: shared, ownerUserId: any_?.user_id ?? null };

  const email = process.env["GREENSALES_EMAIL"];
  const password = process.env["GREENSALES_PASSWORD"];
  return email && password ? { credentials: { email, password }, ownerUserId: null } : null;
}
