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
import type { ScanCompleteness } from "@/lib/crm/scan-completeness";

/** Coluna local do Portal. NÃO existe no GreenSales. */
export const UNLOCATED_STAGE_KEY = "nao_localizado";

export type ReconcileSummary = {
  checked: number;
  moved: number;
  ids: string[];
  /** Varredura não comprovadamente completa — NADA foi movido. */
  aborted: boolean;
  abortReason: string | null;
};

/**
 * Executada SOMENTE após uma varredura COMPROVADAMENTE COMPLETA da
 * origem — nunca depois de uma sincronização incremental, que por
 * definição não lista todos os leads e faria qualquer ausência parecer
 * um desaparecimento.
 *
 * TRAVA DE SEGURANÇA (plano aprovado, item 3): se a varredura tiver
 * qualquer incerteza (página ausente, página vazia inesperada, total
 * incoerente, resposta parcial), a reconciliação ABORTA sem mover
 * ninguém. Uma falha transitória da API jamais transforma leads válidos
 * em NÃO LOCALIZADOS.
 */
export async function reconcileMissingLeads(
  seenExternalIds: Iterable<string>,
  completeness: ScanCompleteness,
): Promise<ReconcileSummary> {
  const seen = new Set(Array.from(seenExternalIds, (id) => String(id)));
  const summary: ReconcileSummary = { checked: 0, moved: 0, ids: [], aborted: false, abortReason: null };
  if (!completeness.complete) {
    summary.aborted = true;
    summary.abortReason =
      completeness.reason ?? "Varredura não comprovadamente completa — reconciliação abortada.";
    return summary;
  }
  if (seen.size === 0) {
    summary.aborted = true;
    summary.abortReason = "Varredura completa não trouxe nenhum registro — reconciliação abortada.";
    return summary;
  }

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

/** Intervalo oficial da reconciliação periódica (COMANDO 3A §6). */
const RECONCILE_INTERVAL_MS = 24 * 3_600_000;

export type DailyReconciliationResult =
  | { ran: true; found: number; moved: number }
  | { ran: false; reason: string };

/**
 * Reconciliação periódica — no máximo 1x a cada 24 horas.
 *
 * A sincronização incremental é, por definição, uma janela parcial: a
 * ausência de um lead nela nunca significa desaparecimento. Por isso a
 * reconciliação só roda sobre uma VARREDURA COMPLETA da origem, com
 * cadência diária, registrada em `crm_sync_runs` (trigger
 * "reconciliacao"). Nada é apagado: leads ausentes da origem são
 * preservados na coluna local NÃO LOCALIZADOS.
 */
export async function runDailyReconciliation(
  actorUserId?: string | null,
): Promise<DailyReconciliationResult> {
  const { data: last } = await supabaseAdmin
    .from("crm_sync_runs")
    .select("started_at")
    .eq("trigger", "reconciliacao")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.started_at && Date.now() - Date.parse(last.started_at) < RECONCILE_INTERVAL_MS) {
    return { ran: false, reason: "intervalo" };
  }

  const { data: run } = await supabaseAdmin
    .from("crm_sync_runs")
    .insert({ trigger: "reconciliacao", status: "RUNNING", started_at: new Date().toISOString() })
    .select("id")
    .single();
  const runId = run?.id ?? null;

  const finish = async (
    status: "OK" | "ERRO",
    result: DailyReconciliationResult,
    message?: string,
  ) => {
    if (runId) {
      await supabaseAdmin
        .from("crm_sync_runs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          found_count: result.ran ? result.found : 0,
          updated_count: result.ran ? result.moved : 0,
          last_error: message ?? null,
        })
        .eq("id", runId);
    }
    return result;
  };

  try {
    const { greenSalesLogin, fetchAllLeads } = await import("@/server/greensales.server");
    const { resolveCredentials } = await import("@/server/crm/connections.server");
    const credentials = await resolveCredentials(actorUserId);
    const token = await greenSalesLogin(credentials);
    const page = await fetchAllLeads(token);
    const reconciled = await reconcileMissingLeads(
      page.leads.map((l) => String(l.id)),
      page.completeness,
    );
    if (reconciled.aborted) {
      const reason = `Reconciliação abortada — ${reconciled.abortReason ?? "varredura incompleta"}. Nenhum estágio foi alterado.`;
      return finish("ERRO", { ran: false, reason }, reason);
    }
    return finish("OK", { ran: true, found: page.leads.length, moved: reconciled.moved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    return finish("ERRO", { ran: false, reason: message }, message);
  }
}
