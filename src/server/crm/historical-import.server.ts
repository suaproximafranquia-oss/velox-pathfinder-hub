/**
 * CARGA HISTÓRICA FINAL — importação idempotente e NÃO destrutiva.
 *
 * Recebe o universo histórico de Leads da GreenSales (extraído do
 * arquivo HAR/RAR fornecido pela gestão) e aplica a regra oficial:
 *
 *  SE O LEAD JÁ EXISTE (external_source + external_id):
 *   - não cria duplicidade;
 *   - não substitui dados;
 *   - não apaga informações;
 *   - preserva histórico, proprietário e eventos — nada é escrito.
 *
 *  SE O LEAD NÃO EXISTE:
 *   - cria o Lead via MESMO upsert idempotente da sincronização;
 *   - marca a origem histórica da importação no payload e no evento;
 *   - NUNCA entra na fila de primeiro contato (historical: true).
 *
 *  Esta rotina NÃO possui nenhuma operação de exclusão e jamais
 *  sobrescreve um lead existente. Executá-la N vezes produz o mesmo
 *  resultado. Ao final, o universo importado fica sob a blindagem
 *  definitiva (gatilho guard_lead_delete) como qualquer outro lead.
 */
import { upsertLead, getLeadEntryState } from "@/server/crm/lead-service.server";

export type HistoricalLeadInput = {
  /** Identificador do lead na origem (chave de deduplicação). */
  externalId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  origin?: string | null;
  captureForm?: string | null;
  pipelineName?: string | null;
  stageKey?: string | null;
  externalStageId?: string | null;
  externalCreatedAt?: string | null;
  tags?: unknown[];
  externalStatus?: string | null;
  rawPayload?: unknown;
};

export type HistoricalImportSummary = {
  received: number;
  created: number;
  alreadyExisting: number;
  errors: { externalId: string; message: string }[];
};

export async function importHistoricalLeads(
  rows: HistoricalLeadInput[],
): Promise<HistoricalImportSummary> {
  const summary: HistoricalImportSummary = {
    received: rows.length,
    created: 0,
    alreadyExisting: 0,
    errors: [],
  };

  for (const row of rows) {
    const externalId = String(row.externalId ?? "").trim();
    if (!externalId) {
      summary.errors.push({ externalId: "(vazio)", message: "Registro sem identificador da origem." });
      continue;
    }
    try {
      // Idempotência: lead conhecido é preservado integralmente.
      const state = await getLeadEntryState(externalId);
      if (state.exists) {
        summary.alreadyExisting += 1;
        continue;
      }
      const outcome = await upsertLead({
        externalId,
        name: (row.name ?? "").trim() || "Lead histórico",
        phone: row.phone ?? "",
        email: row.email ?? "",
        origin: row.origin ?? "Carga histórica GreenSales",
        captureForm: row.captureForm ?? null,
        externalPipelineId: null,
        pipelineName: row.pipelineName ?? null,
        stageKey: row.stageKey ?? null,
        externalStageId: row.externalStageId ?? null,
        externalCreatedAt: row.externalCreatedAt ?? null,
        tags: row.tags ?? [],
        externalStatus: row.externalStatus ?? null,
        rawPayload: {
          ...(row.rawPayload && typeof row.rawPayload === "object"
            ? (row.rawPayload as Record<string, unknown>)
            : {}),
          import_origin: "carga_historica",
        },
        // Histórico: jamais entra na fila de primeiro contato.
        historical: true,
      });
      if (outcome.created) summary.created += 1;
      else summary.alreadyExisting += 1;
    } catch (error) {
      summary.errors.push({
        externalId,
        message: error instanceof Error ? error.message : "Falha desconhecida.",
      });
    }
  }
  return summary;
}
