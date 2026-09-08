/**
 * CENTRAL DOS NOMES — CONSULTA DO MOTOR.
 *
 * A Central já é a base oficial de nomes (≈100 mil registros). O motor
 * NÃO reconstrói, não importa e não altera nada: apenas pergunta se o
 * PRIMEIRO NOME do cadastro existe na Central.
 *
 * Regras invioláveis:
 *  - somente o primeiro nome é usado como tratamento;
 *  - nome não reconhecido não vira tratamento (segue o neutro);
 *  - nenhuma escrita acontece nesta consulta.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { foldName } from "@/lib/relationship/name-base";
import { normalizeName } from "@/lib/relationship/names";

/** Cache curto por processo — a Central é imutável durante o tick. */
const cache = new Map<string, string | null>();

/** Primeiro token utilizável do valor bruto (sem acento, minúsculo). */
export function firstNameKey(raw: string | null | undefined): string {
  const first = normalizeName(raw).split(" ").filter(Boolean)[0] ?? "";
  return first ? foldName(first) : "";
}

/**
 * Retorna o primeiro nome, já apresentável, quando a Central reconhece.
 * Retorna null quando não reconhece — nunca inventa.
 */
export async function resolveCentralFirstName(
  raw: string | null | undefined,
): Promise<string | null> {
  const key = firstNameKey(raw);
  if (!key || key.length < 2) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const { data, error } = await supabaseAdmin
    .from("name_central")
    .select("name,normalized_key")
    .eq("normalized_key", key)
    .maybeSingle();

  if (error) {
    // Falha de leitura NÃO personaliza: o tratamento neutro prevalece.
    return null;
  }
  const row = data as { name?: string | null } | null;
  const resolved = row
    ? normalizeName(row.name ?? key).split(" ").filter(Boolean)[0] ?? null
    : null;
  cache.set(key, resolved);
  return resolved;
}
