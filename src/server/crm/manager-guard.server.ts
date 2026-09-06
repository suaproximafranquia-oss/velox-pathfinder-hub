/**
 * TRAVA ÚNICA — GESTÃO NÃO É LINHA OPERACIONAL.
 *
 * A Gestora/Diretora possui `executive_profile` apenas para identidade e
 * autenticação; ela NÃO é executiva e, portanto, nunca pode ser gravada
 * como `responsible_executive_id` de um lead.
 *
 * A decisão usa a MESMA fonte de verdade já existente (`user_roles`):
 * papel `manager` sem papel `admin`. Nenhuma matriz nova é criada e
 * nenhum dado histórico é alterado por este módulo — ele apenas impede
 * NOVAS atribuições.
 */

const cache = new Map<string, { value: boolean; at: number }>();
const TTL_MS = 60_000;

/** `true` quando o executivo é gestão (manager sem admin). */
export async function isManagementExecutive(
  executiveId: string | null | undefined,
): Promise<boolean> {
  const key = String(executiveId ?? "").trim();
  if (!key) return false;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("executive_profiles")
    .select("user_id")
    .eq("executive_id", key)
    .maybeSingle();
  const userId = (profile as { user_id?: string } | null)?.user_id ?? null;
  if (!userId) {
    cache.set(key, { value: false, at: Date.now() });
    return false;
  }

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const granted = new Set(((roles ?? []) as { role: string }[]).map((r) => r.role));
  const value = granted.has("manager") && !granted.has("admin");
  cache.set(key, { value, at: Date.now() });
  return value;
}

/** Lança quando alguém tenta tornar a gestão responsável por um lead. */
export async function assertAssignableExecutive(
  executiveId: string | null | undefined,
): Promise<void> {
  if (await isManagementExecutive(executiveId)) {
    throw new Error(
      "Perfil de gestão não pode ser responsável por lead: selecione um executivo da equipe.",
    );
  }
}
