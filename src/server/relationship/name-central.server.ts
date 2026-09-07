/**
 * CENTRAL DOS NOMES — persistência (SERVER ONLY).
 *
 * Dicionário manual do Administrador. O servidor apenas guarda o que foi
 * colado: não busca nomes na internet, não aprende com leads, não cria
 * nome por inferência e nunca altera o cadastro original de um lead.
 *
 * A unicidade é garantida pelo banco (índice único em `normalized_key`),
 * de modo que duas inclusões simultâneas do mesmo nome resultam em um
 * único registro.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  nameCentralKey,
  parsePastedNames,
  firstToken,
} from "@/lib/relationship/name-central";

export type CentralName = {
  id: string;
  name: string;
  key: string;
  createdAt: string;
};

export async function listCentralNames(): Promise<CentralName[]> {
  const { data, error } = await supabaseAdmin
    .from("name_central")
    .select("id, name, normalized_key, created_at")
    .order("created_at", { ascending: true })
    .limit(20000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    key: row.normalized_key,
    createdAt: row.created_at,
  }));
}

export type AddNamesResult = { added: number; existing: number; total: number };

/**
 * Inclusão em lote e idempotente. O `upsert` com `ignoreDuplicates`
 * respeita o índice único: nomes equivalentes (caixa, acento ou
 * pontuação diferentes) nunca viram dois registros.
 */
export async function addCentralNames(
  text: string,
  actorName: string,
): Promise<AddNamesResult> {
  const parsed = parsePastedNames(text);
  if (parsed.length === 0) {
    const total = (await listCentralNames()).length;
    return { added: 0, existing: 0, total };
  }

  // Deduplica dentro do próprio lote preservando a primeira forma vista.
  const byKey = new Map<string, string>();
  for (const item of parsed) if (!byKey.has(item.key)) byKey.set(item.key, item.display);

  const keys = [...byKey.keys()];
  const knownKeys = new Set<string>();
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const { data } = await supabaseAdmin
      .from("name_central")
      .select("normalized_key")
      .in("normalized_key", chunk);
    for (const row of data ?? []) knownKeys.add((row as any).normalized_key);
  }

  const rows = keys
    .filter((k) => !knownKeys.has(k))
    .map((k) => ({
      name: byKey.get(k)!,
      normalized_key: k,
      created_by: actorName,
    }));

  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await supabaseAdmin
      .from("name_central")
      .upsert(chunk as any, { onConflict: "normalized_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    added += (data ?? []).length;
  }

  const total = (await listCentralNames()).length;
  return { added, existing: keys.length - added, total };
}

export async function removeCentralName(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("name_central").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * CAMADA AUXILIAR DE INTERPRETAÇÃO (consulta do motor).
 *
 * Recebe o nome ORIGINAL do lead, extrai o primeiro nome, remove ruído
 * de pontuação e procura correspondência EXATA na Central. Não cria
 * registro, não altera o lead e nunca "chuta" entre nomes parecidos:
 * sem correspondência, devolve `null` (sem nome).
 */
export async function resolveNameFromCentral(
  rawName: string | null | undefined,
): Promise<string | null> {
  const key = nameCentralKey(firstToken(rawName));
  if (key.length < 2) return null;
  const { data } = await supabaseAdmin
    .from("name_central")
    .select("name")
    .eq("normalized_key", key)
    .maybeSingle();
  return ((data as { name?: string } | null)?.name ?? null) || null;
}
