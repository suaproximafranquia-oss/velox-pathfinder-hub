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
 *  • FONTE ÚNICA (COMANDO 2A §4): esta tabela substitui
 *    `relationship_content_groups`, que fica congelada como legado e
 *    não é mais lida nem escrita. Uma etapa pode ter N conteúdos
 *    ativos (rotação preservada); quando houver exatamente UM, ele é
 *    tratado como vínculo explícito e sai sem sorteio.
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

/** Todos os vínculos ativos: etapa → ids de conteúdo (ordenados). */
export async function loadStepContentMap(): Promise<Record<string, string[]>> {
  const { data } = await supabaseAdmin
    .from("relationship_step_content_bindings")
    .select("step_key,content_id,position,created_at")
    .eq("scope", SCOPE)
    .eq("active", true);
  /**
   * ORDEM DETERMINÍSTICA DO POOL: posição explícita, depois data de
   * criação e, por último, o id do conteúdo. O terceiro critério existe
   * porque posição e data podem empatar em vínculos antigos — sem ele a
   * rotação dependeria da ordem casual devolvida pelo banco.
   */
  const rows = ((data ?? []) as any[]).slice().sort((a, b) => {
    const pa = Number(a.position ?? 0);
    const pb = Number(b.position ?? 0);
    if (pa !== pb) return pa - pb;
    const ca = String(a.created_at ?? "");
    const cb = String(b.created_at ?? "");
    if (ca !== cb) return ca < cb ? -1 : 1;
    return String(a.content_id).localeCompare(String(b.content_id));
  });
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    const key = String(row.step_key);
    map[key] = [...(map[key] ?? []), String(row.content_id)];
  }
  return map;
}

/**
 * Vínculo EXPLÍCITO para o motor: só existe quando a etapa tem
 * exatamente um conteúdo ativo. Com mais de um, a escolha volta a ser
 * a rotação oficial da Biblioteca — nunca uma inferência por ordem.
 */
export async function loadStepContentBindings(): Promise<Record<string, string>> {
  const groups = await loadStepContentMap();
  const map: Record<string, string> = {};
  for (const [step, ids] of Object.entries(groups)) {
    if (ids.length === 1) map[step] = ids[0]!;
  }
  return map;
}

/** Inverso: conteúdo → etapas em que ele está autorizado. */
export async function loadContentStepMap(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from("relationship_step_content_bindings")
    .select("step_key,content_id")
    .eq("scope", SCOPE)
    .eq("active", true)
    .in("content_id", ids);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as any[]) {
    const key = String(row.content_id);
    map.set(key, [...(map.get(key) ?? []), String(row.step_key)]);
  }
  return map;
}

/**
 * Define TODAS as etapas de um conteúdo (substitui o antigo vínculo por
 * grupos). Desativa o que saiu e ativa o que entrou, preservando o
 * histórico: nada é apagado.
 */
export async function setContentStepBindings(params: {
  contentId: string;
  stepKeys: string[];
  actorName?: string;
}): Promise<void> {
  const desired = Array.from(new Set(params.stepKeys.filter((s) => s.trim().length > 0)));
  const { data: current } = await supabaseAdmin
    .from("relationship_step_content_bindings")
    .select("id,step_key")
    .eq("scope", SCOPE)
    .eq("content_id", params.contentId)
    .eq("active", true);
  const rows = (current ?? []) as any[];
  const active = new Set(rows.map((r) => String(r.step_key)));

  const toDeactivate = rows.filter((r) => !desired.includes(String(r.step_key)));
  if (toDeactivate.length > 0) {
    await supabaseAdmin
      .from("relationship_step_content_bindings")
      .update({ active: false } as any)
      .in("id", toDeactivate.map((r) => String(r.id)));
  }

  const toInsert = desired.filter((step) => !active.has(step));
  if (toInsert.length > 0) {
    /**
     * A posição pertence ao POOL DA ETAPA, não à lista de etapas deste
     * conteúdo. Era esse o erro que deixava todo mundo em position 0 e
     * tornava a rotação imprevisível: cada novo vínculo entra no fim da
     * fila da sua própria etapa.
     */
    const existing = await loadStepContentMap();
    const { error } = await supabaseAdmin.from("relationship_step_content_bindings").insert(
      toInsert.map((step) => ({
        scope: SCOPE,
        step_key: step,
        content_id: params.contentId,
        active: true,
        position: (existing[step]?.length ?? 0),
        created_by_name: params.actorName ?? "Biblioteca de Conteúdos",
      })) as any,
    );
    if (error) throw new Error(error.message);
  }
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
