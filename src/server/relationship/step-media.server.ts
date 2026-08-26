/**
 * VÍNCULO EXPLÍCITO ETAPA ↔ CONTEÚDO (VÍDEO) — SERVER ONLY.
 *
 * Fechamento do BLOCO 2. A Biblioteca de Conteúdos permanece a mesma:
 * aqui não se cria um segundo acervo nem se duplica arquivo. O que
 * passa a existir é uma AMARRAÇÃO declarada: "a etapa X usa ESTE
 * conteúdo da Biblioteca".
 *
 * REGRAS FECHADAS:
 *  • O vínculo aponta para um registro existente em
 *    `relationship_contents` — nunca para uma cópia do arquivo.
 *  • No máximo um vínculo ATIVO por etapa (índice único no banco).
 *  • O motor consulta o vínculo pela ETAPA. Nome do arquivo, posição na
 *    lista ou ordem de criação NUNCA são usados para inferir o vídeo.
 *  • Sem vínculo, o comportamento anterior (sorteio dentro do grupo de
 *    conteúdo autorizado) continua valendo — nada regride.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SCOPE = "production";

export type StepContentBinding = {
  id: string;
  stepKey: string;
  contentId: string;
  contentName: string | null;
  contentKind: string | null;
  active: boolean;
  notes: string | null;
  createdByName: string;
  updatedAt: string;
};

/** Vínculos ativos: etapa → id do conteúdo da Biblioteca. */
export async function loadStepContentBindings(): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("relationship_step_content_bindings")
    .select("step_key,content_id")
    .eq("scope", SCOPE)
    .eq("active", true);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as any[]) map[String(row.step_key)] = String(row.content_id);
  return map;
}

/** Lista para a interface, já com o nome real do conteúdo vinculado. */
export async function listStepContentBindings(): Promise<StepContentBinding[]> {
  const { data, error } = await supabaseAdmin
    .from("relationship_step_content_bindings")
    .select("*")
    .eq("scope", SCOPE)
    .eq("active", true)
    .order("step_key", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const { data: contents } = await supabaseAdmin
    .from("relationship_contents")
    .select("id,name,kind")
    .in("id", rows.map((r) => String(r.content_id)));
  const byId = new Map((contents ?? []).map((c: any) => [String(c.id), c]));

  return rows.map((row) => {
    const content = byId.get(String(row.content_id));
    return {
      id: String(row.id),
      stepKey: String(row.step_key),
      contentId: String(row.content_id),
      contentName: content?.name ?? null,
      contentKind: content?.kind ?? null,
      active: Boolean(row.active),
      notes: row.notes ?? null,
      createdByName: String(row.created_by_name ?? "sistema"),
      updatedAt: String(row.updated_at ?? row.created_at),
    };
  });
}

/**
 * Define (ou substitui) o conteúdo de uma etapa. A substituição
 * desativa o vínculo anterior em vez de apagá-lo — o histórico de quem
 * vinculou o quê permanece auditável.
 */
export async function setStepContentBinding(params: {
  stepKey: string;
  contentId: string;
  notes?: string | null;
  actorId?: string | null;
  actorName: string;
}): Promise<StepContentBinding[]> {
  const { data: content } = await supabaseAdmin
    .from("relationship_contents")
    .select("id,active")
    .eq("id", params.contentId)
    .maybeSingle();
  if (!content) throw new Error("Conteúdo não encontrado na Biblioteca de Conteúdos.");
  if (!(content as any).active)
    throw new Error("Conteúdo inativo não pode ser vinculado a uma etapa.");

  await supabaseAdmin
    .from("relationship_step_content_bindings")
    .update({ active: false } as any)
    .eq("scope", SCOPE)
    .eq("step_key", params.stepKey)
    .eq("active", true);

  const { error } = await supabaseAdmin.from("relationship_step_content_bindings").insert({
    scope: SCOPE,
    step_key: params.stepKey,
    content_id: params.contentId,
    active: true,
    notes: params.notes ?? null,
    created_by: params.actorId ?? null,
    created_by_name: params.actorName,
  } as any);
  if (error) throw new Error(error.message);
  return listStepContentBindings();
}

/** Remove o vínculo da etapa — o conteúdo continua na Biblioteca. */
export async function clearStepContentBinding(stepKey: string): Promise<StepContentBinding[]> {
  await supabaseAdmin
    .from("relationship_step_content_bindings")
    .update({ active: false } as any)
    .eq("scope", SCOPE)
    .eq("step_key", stepKey)
    .eq("active", true);
  return listStepContentBindings();
}
