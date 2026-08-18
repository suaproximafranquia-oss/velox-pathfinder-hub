/**
 * Fonte única do token de acesso usado por TODA chamada ao servidor.
 *
 * Causa raiz corrigida aqui: o Portal possui duas camadas de sessão — a
 * sessão do workspace (interface) e a sessão real do backend. Quando a
 * segunda expirava ou nunca havia sido aberta naquele navegador, as
 * server functions eram chamadas sem `Authorization` e o backend
 * respondia "Unauthorized: No authorization header provided", fazendo a
 * tela cair para o cache local — daí o estado divergente entre
 * navegadores.
 *
 * Agora qualquer chamada garante a sessão real antes de seguir.
 */
import { supabase } from "@/integrations/supabase/client";

/** Evita recursão: a própria reabertura da sessão usa server functions. */
let restoring: Promise<string | null> | null = null;
let insideRestore = false;

async function readToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function restore(): Promise<string | null> {
  const { ensureCloudSession } = await import("@/lib/executive-auth");
  insideRestore = true;
  try {
    const ok = await ensureCloudSession();
    return ok ? await readToken() : null;
  } finally {
    insideRestore = false;
  }
}

/**
 * Devolve o token válido, reabrindo a sessão do backend quando o
 * navegador tiver apenas a sessão do workspace.
 */
export async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const token = await readToken();
    if (token) return token;
    if (insideRestore) return null;
    if (!restoring) {
      restoring = restore().finally(() => {
        restoring = null;
      });
    }
    return await restoring;
  } catch {
    return null;
  }
}
