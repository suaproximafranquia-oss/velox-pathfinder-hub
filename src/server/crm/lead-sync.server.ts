/**
 * Sync Service — recebe os leads da origem externa e alimenta o nosso CRM.
 *
 * A execução é tolerante a falhas: um lead com problema não interrompe o
 * ciclo, o erro fica registrado no próprio lead e na execução. Toda
 * execução é auditável em `crm_sync_runs`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeGreenSalesLead } from "@/lib/greensales/normalize";
import {
  GREENSALES_INTAKE_PAUSED,
  GREENSALES_INTAKE_PAUSED_MESSAGE,
} from "@/lib/crm/ingestion";
import { cadenceEligibility } from "@/lib/crm/cutover";
import { E0_SIMULATION_ENABLED, E0_SIMULATION_LABEL } from "@/lib/crm/e0-simulation";
import { isE0NightWindow } from "@/lib/crm/e0-window";
import {
  deferFirstContact,
  processDeferredFirstContacts,
} from "@/server/crm/first-contact-queue.server";
import { resolveEntryFlow } from "@/lib/relationship/entry";
import { loadSettings, processWelcome } from "@/server/crm/automation.server";
import {
  getLeadEntryState,
  isNewCommercialEntry,
  markSyncFailure,
  recordEvent,
  upsertLead,
} from "@/server/crm/lead-service.server";
import { ensureWorkspaceCard } from "@/server/crm/workspace-card.server";
import {
  DEFAULT_PIPELINE_EXTERNAL_ID,
  loadPipeline,
  resolveBoardStage,
} from "@/server/crm/pipeline-service.server";

export type SyncSummary = {
  ok: boolean;
  runId: string | null;
  trigger: string;
  windowStart: string;
  found: number;
  created: number;
  updated: number;
  failed: number;
  welcomeSent: number;
  welcomeFailed: number;
  message?: string;
  errors: string[];
};

/** Sobreposição de segurança: reprocessa a janela recente sem duplicar. */
const OVERLAP_MINUTES = 15;
const DEFAULT_LOOKBACK_MINUTES = 60;

export async function runLeadSync(
  trigger: "cron" | "manual",
  actorUserId?: string | null,
): Promise<SyncSummary> {
  const startedAt = new Date();
  /**
   * Ingestão pausada: nada é consultado, nada é importado e nenhuma
   * execução é registrada. A estrutura da integração permanece intacta.
   */
  if (GREENSALES_INTAKE_PAUSED) {
    return {
      ok: true,
      runId: null,
      trigger,
      windowStart: startedAt.toISOString(),
      found: 0,
      created: 0,
      updated: 0,
      failed: 0,
      welcomeSent: 0,
      welcomeFailed: 0,
      message: GREENSALES_INTAKE_PAUSED_MESSAGE,
      errors: [],
    };
  }
  const { data: lastRun } = await supabaseAdmin
    .from("crm_sync_runs")
    .select("finished_at")
    .eq("status", "OK")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const since = lastRun?.finished_at
    ? new Date(new Date(lastRun.finished_at).getTime() - OVERLAP_MINUTES * 60_000)
    : new Date(startedAt.getTime() - DEFAULT_LOOKBACK_MINUTES * 60_000);

  const { data: run } = await supabaseAdmin
    .from("crm_sync_runs")
    .insert({ trigger, status: "RUNNING", started_at: startedAt.toISOString() })
    .select("id")
    .single();
  const runId = run?.id ?? null;

  const summary: SyncSummary = {
    ok: false,
    runId,
    trigger,
    windowStart: since.toISOString(),
    found: 0,
    created: 0,
    updated: 0,
    failed: 0,
    welcomeSent: 0,
    welcomeFailed: 0,
    errors: [],
  };

  const finish = async (status: "OK" | "ERRO", message?: string) => {
    summary.ok = status === "OK";
    summary.message = message;
    if (runId) {
      await supabaseAdmin
        .from("crm_sync_runs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          found_count: summary.found,
          created_count: summary.created,
          updated_count: summary.updated,
          error_count: summary.failed,
          welcome_sent_count: summary.welcomeSent,
          welcome_failed_count: summary.welcomeFailed,
          last_error: message ?? summary.errors[0] ?? null,
        })
        .eq("id", runId);
    }
    return summary;
  };

  const pipeline = await loadPipeline(DEFAULT_PIPELINE_EXTERNAL_ID);
  if (!pipeline) return finish("ERRO", "Funil não configurado no CRM.");

  const settings = await loadSettings();
  const { greenSalesLogin, fetchLeadsSince, fetchLeadDetail } = await import(
    "@/server/greensales.server"
  );

  const { resolveCredentials } = await import("@/server/crm/connections.server");
  const credentials = await resolveCredentials(actorUserId);

  let token: string;
  try {
    token = await greenSalesLogin(credentials);
  } catch (error) {
    return finish("ERRO", error instanceof Error ? error.message : "Falha de autenticação.");
  }

  let leads: Awaited<ReturnType<typeof fetchLeadsSince>>["leads"];
  try {
    leads = (await fetchLeadsSince(token, since)).leads;
  } catch (error) {
    return finish("ERRO", error instanceof Error ? error.message : "Falha na consulta de leads.");
  }
  summary.found = leads.length;

  for (const listed of leads) {
    const externalId = String(listed.id);
    try {
      const detail = (await fetchLeadDetail(token, listed.id)) ?? listed;
      const raw = { ...listed, ...detail, id: externalId } as Record<string, unknown>;
      /**
       * CAMINHO ÚNICO DE ENTRADA (`intakeLead`): espelho → card do
       * Workspace → E0 → motor. Extraído sem mudança de comportamento,
       * para que o ambiente de teste percorra exatamente este caminho.
       */
      const outcome = await intakeLead(raw, { pipeline, settings });
      if (outcome.created) summary.created += 1;
      else if (outcome.changed) summary.updated += 1;
      summary.welcomeSent += outcome.welcomeSent;
      summary.welcomeFailed += outcome.welcomeFailed;
      if (outcome.failed) {
        summary.failed += 1;
        summary.errors.push(`Lead ${externalId}: ${outcome.error ?? "falha desconhecida"}`);
      }

    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      summary.errors.push(`Lead ${externalId}: ${message}`);
      await markSyncFailure(externalId, message);
    }
  }

  /**
   * Fecha o ciclo executando as E0 adiadas pela madrugada assim que a
   * janela operacional estiver aberta.
   */
  const deferredRun = await processDeferredFirstContacts();
  summary.welcomeSent += deferredRun.sent;
  summary.errors.push(...deferredRun.errors);

  return finish("OK");
}

export type BackfillSummary = {
  ok: boolean;
  runId: string | null;
  pagesScanned: number;
  totalReported: number | null;
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  welcomeSent: 0;
  message?: string;
  errors: string[];
};

/**
 * Carga histórica — reconstrução do estado inicial.
 *
 * Percorre toda a paginação da origem e aplica o MESMO upsert idempotente
 * da sincronização incremental. Nenhum registro é apagado, nenhum lead é
 * duplicado e nenhuma mensagem de primeiro contato é disparada.
 */
export async function runGreenSalesBackfill(
  actorUserId?: string | null,
): Promise<BackfillSummary> {
  const startedAt = new Date();
  const { data: run } = await supabaseAdmin
    .from("crm_sync_runs")
    .insert({ trigger: "backfill", status: "RUNNING", started_at: startedAt.toISOString() })
    .select("id")
    .single();
  const runId = run?.id ?? null;

  const summary: BackfillSummary = {
    ok: false,
    runId,
    pagesScanned: 0,
    totalReported: null,
    found: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    welcomeSent: 0,
    errors: [],
  };

  const finish = async (status: "OK" | "ERRO", message?: string) => {
    summary.ok = status === "OK";
    summary.message = message;
    if (runId) {
      await supabaseAdmin
        .from("crm_sync_runs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          found_count: summary.found,
          created_count: summary.created,
          updated_count: summary.updated,
          skipped_count: summary.unchanged,
          error_count: summary.failed,
          welcome_sent_count: 0,
          welcome_failed_count: 0,
          last_error: message ?? summary.errors[0] ?? null,
        })
        .eq("id", runId);
    }
    return summary;
  };

  const pipeline = await loadPipeline(DEFAULT_PIPELINE_EXTERNAL_ID);
  if (!pipeline) return finish("ERRO", "Funil não configurado no CRM.");

  const { greenSalesLogin, fetchAllLeads, fetchLeadDetail } = await import(
    "@/server/greensales.server"
  );
  const { resolveCredentials } = await import("@/server/crm/connections.server");
  const credentials = await resolveCredentials(actorUserId);

  let token: string;
  try {
    token = await greenSalesLogin(credentials);
  } catch (error) {
    return finish("ERRO", error instanceof Error ? error.message : "Falha de autenticação.");
  }

  let page: Awaited<ReturnType<typeof fetchAllLeads>>;
  try {
    page = await fetchAllLeads(token);
  } catch (error) {
    return finish("ERRO", error instanceof Error ? error.message : "Falha na consulta de leads.");
  }
  summary.found = page.leads.length;
  summary.pagesScanned = page.pagesScanned;
  summary.totalReported = page.totalReported;

  for (const listed of page.leads) {
    const externalId = String(listed.id);
    try {
      const detail = (await fetchLeadDetail(token, listed.id)) ?? listed;
      const raw = { ...listed, ...detail } as Record<string, unknown>;
      const normalized = normalizeGreenSalesLead(raw as never);
      const rawTags = Array.isArray(raw["tags"]) ? (raw["tags"] as { id: number | string }[]) : [];
      const tagIds = rawTags.map((t) => String(t.id));
      // Nova entrada comercial: a MESMA pessoa realizou um novo cadastro.
      // A origem devolve isso em `last_register_at` (fallback `register`).
      const lastEntryAt =
        (raw["last_register_at"] as string) ??
        (raw["register"] as string) ??
        (raw["created_at"] as string) ??
        null;
      const known = await getLeadEntryState(externalId);
      void isNewCommercialEntry(known.lastEntryAt, lastEntryAt);
      // Board é a fonte da verdade também na carga histórica.
      const { stage, remarketing } = resolveBoardStage(pipeline, tagIds);
      const forms = Array.isArray(raw["forms"]) ? (raw["forms"] as { title?: string }[]) : [];

      const outcome = await upsertLead({
        externalId,
        name: normalized.name,
        phone: normalized.whatsapp,
        email: normalized.email,
        origin: (raw["origin"] as string) ?? null,
        captureForm: forms[0]?.title ?? null,
        externalPipelineId: pipeline.externalId,
        pipelineName: pipeline.name,
        stageKey: stage?.key ?? null,
        externalStageId: stage?.externalTag ?? null,
        externalCreatedAt: (raw["created_at"] as string) ?? null,
        lastEntryAt,
        tags: rawTags,
        externalStatus: (raw["status"] as string) ?? null,
        remarketing,
        entryStage: Boolean(stage?.isEntry),
        rawPayload: raw,
        historical: true,
      });
      if (outcome.created) summary.created += 1;
      else if (outcome.changed) summary.updated += 1;
      else summary.unchanged += 1;
      // Nenhuma automação de primeiro contato aqui — por definição.
    } catch (error) {
      // Um registro com problema não interrompe a reconstrução do estado.
      summary.failed += 1;
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      if (summary.errors.length < 20) summary.errors.push(`Lead ${externalId}: ${message}`);
      await markSyncFailure(externalId, message);
    }
  }

  /**
   * A varredura COMPLETA é o único momento em que a ausência de um lead
   * significa alguma coisa. Quem estava em NOVOS e não apareceu foi
   * redistribuído: preservamos o registro na coluna local NÃO
   * LOCALIZADOS, sem tocar na origem nem nas colunas espelho.
   */
  try {
    const { reconcileMissingLeads } = await import("@/server/crm/reconcile.server");
    const reconciled = await reconcileMissingLeads(page.leads.map((l) => String(l.id)));
    if (reconciled.moved > 0) {
      summary.errors.push(
        `${reconciled.moved} lead(s) de NOVOS não localizados na origem — preservados em NÃO LOCALIZADOS.`,
      );
    }
  } catch (error) {
    console.error(
      "[backfill] reconciliação de leads não localizados falhou:",
      error instanceof Error ? error.message : error,
    );
  }

  return finish("OK");
}
