/**
 * NOTAS DO EXECUTIVO — SERVER ONLY.
 *
 * As notas internas do investidor passam a viver no BANCO
 * (`investor_notes`), nunca no navegador: qualquer computador, sessão
 * ou executivo autorizado enxerga exatamente o mesmo histórico.
 *
 * REGRAS:
 *   • o AUTOR é sempre resolvido no servidor (sessão), nunca aceito
 *     do navegador;
 *   • `source_key` é a chave de origem/idempotência — repetir a mesma
 *     ação (ex.: concluir duas vezes o mesmo item da fila) nunca cria
 *     duas notas;
 *   • nada aqui apaga, reescreve ou migra histórico existente.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type InvestorNoteRow = {
  id: string;
  leadId: string;
  body: string;
  authorName: string | null;
  authorExecutiveId: string | null;
  createdAt: string;
  sourceKey: string | null;
};

const COLUMNS =
  "id,lead_id,body,author_name,author_executive_id,created_at,source_key";

type RawNote = {
  id: string;
  lead_id: string;
  body: string;
  author_name: string | null;
  author_executive_id: string | null;
  created_at: string;
  source_key: string | null;
};

function toRow(row: RawNote): InvestorNoteRow {
  return {
    id: row.id,
    leadId: row.lead_id,
    body: row.body,
    authorName: row.author_name,
    authorExecutiveId: row.author_executive_id,
    createdAt: row.created_at,
    sourceKey: row.source_key,
  };
}

/** Histórico oficial de notas de um investidor (mais recente primeiro). */
export async function listInvestorNotes(leadId: string): Promise<InvestorNoteRow[]> {
  if (!leadId) return [];
  const { data } = await supabaseAdmin
    .from("investor_notes")
    .select(COLUMNS)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as RawNote[]).map(toRow);
}

/** Nome de exibição do autor, resolvido pelo cadastro oficial. */
export async function resolveAuthorName(input: {
  executiveId: string | null;
  userId: string;
}): Promise<string | null> {
  if (input.executiveId) {
    const { data } = await supabaseAdmin
      .from("executive_profiles")
      .select("name")
      .eq("executive_id", input.executiveId)
      .maybeSingle();
    const name = (data as { name?: string } | null)?.name;
    if (name) return name;
  }
  const { data } = await supabaseAdmin
    .from("executive_profiles")
    .select("name")
    .eq("user_id", input.userId)
    .maybeSingle();
  return (data as { name?: string } | null)?.name ?? null;
}

/**
 * Grava uma nota. Idempotente quando `sourceKey` é informado: o índice
 * único do banco impede a segunda gravação da mesma origem.
 */
export async function addInvestorNote(input: {
  leadId: string;
  body: string;
  userId: string;
  executiveId: string | null;
  authorName?: string | null;
  scope?: string | null;
  sourceKey?: string | null;
}): Promise<{ created: boolean }> {
  const body = input.body.trim();
  if (!input.leadId || body.length === 0) return { created: false };

  if (input.sourceKey) {
    const { data: existing } = await supabaseAdmin
      .from("investor_notes")
      .select("id")
      .eq("source_key", input.sourceKey)
      .maybeSingle();
    if (existing) return { created: false };
  }

  const authorName =
    input.authorName ??
    (await resolveAuthorName({ executiveId: input.executiveId, userId: input.userId }));

  const { error } = await supabaseAdmin.from("investor_notes").insert({
    lead_id: input.leadId,
    body,
    scope: input.scope ?? null,
    author_user_id: input.userId,
    author_executive_id: input.executiveId,
    author_name: authorName,
    source_key: input.sourceKey ?? null,
  } as never);

  // Corrida com o índice único: a nota já existe, nada a fazer.
  if (error) {
    if (/duplicate key/i.test(error.message)) return { created: false };
    throw new Error(error.message);
  }
  return { created: true };
}
