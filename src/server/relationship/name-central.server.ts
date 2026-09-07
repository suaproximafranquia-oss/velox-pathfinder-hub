/**
 * CENTRAL DOS NOMES — persistência (SERVER ONLY).
 *
 * Dicionário manual do Administrador. O servidor apenas guarda o que foi
 * entregue: não busca nomes na internet, não aprende com leads, não cria
 * nome por inferência e nunca altera o cadastro original de um lead.
 *
 * A unicidade é garantida pelo banco (índice único em `normalized_key`),
 * de modo que inclusões simultâneas do mesmo nome resultam em um único
 * registro. A INCLUSÃO EM LOTE não vive mais aqui: quem recebe grandes
 * volumes é a fila (`name-central-import.server.ts`), para que o
 * processamento continue com a página fechada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nameCentralKey, firstToken } from "@/lib/relationship/name-central";

export type CentralName = {
  id: string;
  name: string;
  key: string;
  createdAt: string;
};

/** Página da listagem — o banco pode ter centenas de milhares de nomes. */
export type NamePage = {
  items: CentralName[];
  total: number;
  offset: number;
  limit: number;
};

/** Contagem REAL no banco, independente do que a tela carregou. */
export async function countCentralNames(search?: string): Promise<number> {
  let query = supabaseAdmin
    .from("name_central")
    .select("id", { count: "exact", head: true });
  const key = nameCentralKey(search);
  if (key) query = query.like("normalized_key", `%${key}%`);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Listagem paginada, ordenada por tamanho do nome (a mesma lógica das
 * faixas exibidas) e, dentro do tamanho, por nome.
 */
export async function listCentralNames(options?: {
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<NamePage> {
  const offset = Math.max(0, options?.offset ?? 0);
  const limit = Math.min(500, Math.max(1, options?.limit ?? 300));
  const key = nameCentralKey(options?.search);

  let query = supabaseAdmin
    .from("name_central")
    .select("id, name, normalized_key, created_at", { count: "exact" })
    .order("name_length", { ascending: true })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (key) query = query.like("normalized_key", `%${key}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    items: (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      key: row.normalized_key,
      createdAt: row.created_at,
    })),
    total: count ?? 0,
    offset,
    limit,
  };
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
