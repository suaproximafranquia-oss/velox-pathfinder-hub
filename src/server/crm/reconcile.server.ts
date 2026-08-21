/**
 * RECONCILIAÇÃO — LEADS QUE SAÍRAM DA VISÃO DA ORIGEM.
 *
 * Um lead pode ser redistribuído manualmente pela gestão e simplesmente
 * deixar de aparecer para o nosso login no GreenSales. Isso NÃO é
 * exclusão: o registro continua existindo, apenas pertence a outro
 * executivo, e o nosso sistema não tem como (nem precisa) descobrir a
 * quem.
 *
 * Regras (COMANDO §15–§17):
 *   • nada é apagado, nenhum ID novo é criado, nenhum histórico é perdido;
 *   • nenhuma coluna espelho do GreenSales é alterada;
 *   • o lead vai para a coluna LOCAL `nao_localizado`, que existe apenas
 *     no nosso Portal e nunca movimenta a origem;
 *   • só participa quem estava na coluna de entrada (NOVOS) — as demais
 *     colunas permanecem exatamente como o espelho as deixou.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordEvent } from "@/server/crm/lead-service.server";

/** Coluna local do Portal. NÃO existe no GreenSales. */
export const UNLOCATED_STAGE_KEY = "nao_localizado";

export type ReconcileSummary = { checked: number; moved: number; ids: string[] };

/**
 * Executada SOMENTE após uma varredura COMPLETA da origem — nunca depois
 * de uma sincronização incremental, que por definição não lista todos os
 * leads e faria qualquer ausência parecer um desaparecimento.
 */
export async function reconcileMissingLeads(
  seenExternalIds: Iterable<string>,
): Promise<ReconcileSummary> {
  const seen = new Set(Array.from(seenExternalIds, (id) => String(id)));
  const summary: ReconcileSummary = { checked: 0, moved: 0, ids: [] };
  if (seen.size === 0) return summary;

  const { data: leads } = await supabaseAdmin
    .from("crm_leads")
    .select("id,external_id,name,stage_key")
    .eq("stage_key", "novos")
    // Lead de TESTE não existe na origem por definição: ausência ali
    // nunca significa redistribuição e jamais move a coluna dele.
    .eq("is_test", false)
    .limit(5000);

  const now = new Date().toISOString();
  for (const lead of leads ?? []) {
    summary.checked += 1;
    if (seen.has(String(lead.external_id))) continue;
    const { error } = await supabaseAdmin
      .from("crm_leads")
      .update({ stage_key: UNLOCATED_STAGE_KEY, stage_entered_at: now })
      .eq("id", lead.id);
    if (error) continue;
    summary.moved += 1;
    summary.ids.push(lead.external_id);
    await recordEvent(
      lead.id,
      "lead_nao_localizado",
      "Lead não localizado na origem durante varredura completa — provavelmente redistribuído pela gestão. Registro preservado na coluna local NÃO LOCALIZADOS.",
    );
  }
  return summary;
}
