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
import { processDeferredFirstContacts } from "@/server/crm/first-contact-queue.server";
import { loadSettings } from "@/server/crm/automation.server";
import {
  getLeadEntryState,
  isNewCommercialEntry,
  markSyncFailure,
  upsertLead,
} from "@/server/crm/lead-service.server";
import { classifyScannedLead } from "@/lib/crm/sync-classification";
import { intakeLead } from "@/server/crm/lead-intake.server";
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
  /** Destes criados, quantos são recuperação histórica (CASO B, sem E0). */
  recovered: number;
  updated: number;
  /** Entradas ignoradas pela segunda trava de deduplicação (telefone). */
  duplicatesAvoided: number;
  failed: number;
  welcomeSent: number;
  welcomeFailed: number;
  message?: string;
  errors: string[];
};

/** Sobreposição de segurança: reprocessa a janela recente sem duplicar. */
const OVERLAP_MINUTES = 15;
const DEFAULT_LOOKBACK_MINUTES = 60;

/**
 * Execuções interrompidas por erro inesperado não podem ficar eternamente
 * em RUNNING: elas bloqueariam o agendador. Toda execução mais antiga que
 * a janela operacional é encerrada como ERRO antes de uma nova começar.
 * Nenhuma regra comercial muda com isso.
 */
const STALE_RUN_MINUTES = 15;

async function closeStaleSyncRuns(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString();
  await supabaseAdmin
    .from("crm_sync_runs")
    .update({
      status: "ERRO",
      finished_at: new Date().toISOString(),
      last_error: "Execução interrompida sem encerramento — fechada automaticamente.",
    } as never)
    .eq("status", "RUNNING")
    .lt("started_at", cutoff);
}

export async function runLeadSync(
  trigger: "cron" | "manual",
  actorUserId?: string | null,
): Promise<SyncSummary> {
  await closeStaleSyncRuns();
  const ref: { runId: string | null } = { runId: null };
  try {
    return await runLeadSyncInner(trigger, actorUserId, ref);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada na sincronização.";
    if (ref.runId) {
      await supabaseAdmin
        .from("crm_sync_runs")
        .update({
          status: "ERRO",
          finished_at: new Date().toISOString(),
          last_error: message,
        } as never)
        .eq("id", ref.runId);
    }
    return {
      ok: false,
      runId: ref.runId,
      trigger,
      windowStart: new Date().toISOString(),
      found: 0,
      created: 0,
      recovered: 0,
      updated: 0,
      duplicatesAvoided: 0,
      failed: 0,
      welcomeSent: 0,
      welcomeFailed: 0,
      message,
      errors: [message],
    };
  }
}

async function runLeadSyncInner(
  trigger: "cron" | "manual",
  actorUserId: string | null | undefined,
  ref: { runId: string | null },
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
      recovered: 0,
      updated: 0,
      duplicatesAvoided: 0,
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
  ref.runId = runId;

  const summary: SyncSummary = {
    ok: false,
    runId,
    trigger,
    windowStart: since.toISOString(),
    found: 0,
    created: 0,
    recovered: 0,
    updated: 0,
    duplicatesAvoided: 0,
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

  const { resolveConnectionContext } = await import("@/server/crm/connections.server");
  const connection = await resolveConnectionContext(actorUserId);
  const credentials = connection?.credentials ?? null;
  /** Identidade do dono da conexão preservada até a criação do card. */
  const connectionUserId = actorUserId ?? connection?.ownerUserId ?? null;

  let token: string;
  try {
    token = await greenSalesLogin(credentials);
  } catch (error) {
    return finish("ERRO", error instanceof Error ? error.message : "Falha de autenticação.");
  }

  let leads: Awaited<ReturnType<typeof fetchLeadsSince>>["leads"];
  let scanned: Awaited<ReturnType<typeof fetchLeadsSince>>["scanned"] = [];
  try {
    const result = await fetchLeadsSince(token, since);
    leads = result.leads;
    scanned = result.scanned;
  } catch (error) {
    return finish("ERRO", error instanceof Error ? error.message : "Falha na consulta de leads.");
  }
  summary.found = leads.length;

  /**
   * CLASSIFICAÇÃO EXPLÍCITA A/B/C/D (plano aprovado — regra central).
   *
   * "Ausente do espelho" NÃO significa "lead novo":
   *   A — entrada recente comprovada → intake normal (E0 pelas regras
   *       atuais, comportamento de lead novo preservado);
   *   B — histórico nunca ingerido → recuperação silenciosa via
   *       upsertLead({ historical: true }): SEM E0, SEM card, SEM
   *       cadência. NUNCA passa pelo intake, que marcaria a entrada
   *       como "agora" e tornaria o histórico elegível a disparos;
   *   C — espelho com estágio divergente → intake (só atualiza o
   *       espelho; E0 só em transição real para NOVOS, como sempre);
   *   D — sem mudança → ignorado.
   *
   * A guarda antiga (`!storedStage.has → continue`) tornava invisível
   * para sempre um lead nunca ingerido (caso Reginaldo, 54339).
   */
  const inWindow = new Set(leads.map((l) => String(l.id)));
  const { data: mirror } = await supabaseAdmin
    .from("crm_leads")
    .select("external_id,stage_key")
    .eq("external_source", "greensales");
  const storedStage = new Map((mirror ?? []).map((r) => [r.external_id, r.stage_key]));

  type ScannedLead = (typeof scanned)[number];
  const entryAtOf = (lead: ScannedLead): string | null =>
    ((lead as Record<string, unknown>)["last_register_at"] as string) ??
    ((lead as Record<string, unknown>)["register"] as string) ??
    lead.created_at ??
    null;
  const stageKeyOf = (lead: ScannedLead): string | null => {
    const tagIds = Array.isArray(lead.tags)
      ? (lead.tags as { id: number | string }[]).map((t) => String(t.id))
      : [];
    return resolveBoardStage(pipeline, tagIds).stage?.key ?? null;
  };

  const toProcess: { listed: ScannedLead; cls: "A" | "B" | "C" }[] = [];
  for (const listed of leads) {
    const externalId = String(listed.id);
    if (storedStage.has(externalId)) {
      // Já espelhado e dentro da janela: o intake aplica o upsert
      // idempotente (casos C/D internos) — comportamento preservado.
      toProcess.push({ listed, cls: "A" });
      continue;
    }
    const cls = classifyScannedLead({
      inWindow: true,
      inMirror: false,
      mirrorStage: null,
      resolvedStage: stageKeyOf(listed),
      entryAt: entryAtOf(listed),
      since,
    });
    // Fora do espelho a classificação só produz A ou B; a guarda é só
    // para o tipo. Um "D" aqui seria contradição — não processar.
    if (cls === "D") continue;
    toProcess.push({ listed, cls });
  }
  let divergentCount = 0;
  /**
   * §4 — RECONCILIAÇÃO DE ETAPA IGUAL À DA CARGA HISTÓRICA.
   *
   * A listagem devolve as etiquetas (`withs`), mas nem sempre: quando
   * ela vem sem `tags`, a coluna não é resolvida e a sincronização
   * incremental simplesmente não via a mudança — o lead permanecia
   * indevidamente na etapa anterior, enquanto a carga histórica (que
   * sempre consulta o detalhe) corrigia. Agora, todo lead já espelhado
   * cuja listagem NÃO resolve coluna é verificado pelo detalhe, com
   * limite por execução para não sobrecarregar a origem.
   */
  const needsDetailCheck: ScannedLead[] = [];
  for (const listed of scanned) {
    const externalId = String(listed.id);
    if (inWindow.has(externalId)) continue;
    if (!storedStage.has(externalId)) {
      // Histórico ausente do espelho — recuperação (CASO B), nunca E0.
      toProcess.push({ listed, cls: "B" });
      continue;
    }
    const resolved = stageKeyOf(listed);
    if (!resolved) {
      needsDetailCheck.push(listed);
      continue;
    }
    if (resolved !== storedStage.get(externalId)) {
      divergentCount += 1;
      toProcess.push({ listed, cls: "C" });
    }
  }

  const DETAIL_CHECK_LIMIT = 80;
  let detailChecked = 0;
  for (const listed of needsDetailCheck.slice(0, DETAIL_CHECK_LIMIT)) {
    const externalId = String(listed.id);
    try {
      const detail = await fetchLeadDetail(token, listed.id);
      detailChecked += 1;
      if (!detail) continue;
      const merged = { ...listed, ...detail } as ScannedLead;
      const resolved = stageKeyOf(merged);
      // Sem etiqueta de coluna resolvida NÃO há evidência de mudança —
      // jamais rebaixamos um lead por ausência de informação.
      if (resolved && resolved !== storedStage.get(externalId)) {
        divergentCount += 1;
        toProcess.push({ listed: merged, cls: "C" });
      }
    } catch (error) {
      // Um lead problemático nunca derruba a execução (§5).
      summary.errors.push(
        `Lead ${externalId} (verificação de etapa): ${error instanceof Error ? error.message : "falha desconhecida"}`,
      );
    }
  }

  const caseBCount = toProcess.filter((t) => t.cls === "B").length;
  if (divergentCount || caseBCount || detailChecked) {
    console.warn(
      `[crm-sync] reconciliação: ${divergentCount} divergente(s), ${caseBCount} histórico(s) ausente(s), ${detailChecked} verificação(ões) por detalhe.`,
    );
  }


  for (const { listed, cls } of toProcess) {
    const externalId = String(listed.id);
    try {
      const detail = (await fetchLeadDetail(token, listed.id)) ?? listed;
      const raw = { ...listed, ...detail, id: externalId } as Record<string, unknown>;
      /**
       * A listagem agora traz etiquetas (`withs`). Se o detalhe vier sem
       * elas, o spread não pode apagar a informação da listagem — sem as
       * etiquetas a coluna do quadro não é resolvida e o lead ficaria
       * preso na etapa anterior (foi um dos fatores do caso Marcelo).
       */
      if (!Array.isArray(raw["tags"]) || (raw["tags"] as unknown[]).length === 0) {
        raw["tags"] = (listed as { tags?: unknown[] }).tags ?? [];
      }
      if (!Array.isArray(raw["forms"]) || (raw["forms"] as unknown[]).length === 0) {
        raw["forms"] = (listed as { forms?: unknown[] }).forms ?? [];
      }

      if (cls === "B") {
        /**
         * CASO B — RECUPERAÇÃO HISTÓRICA: mesma semântica da carga
         * histórica (upsert com historical:true). O lead entra no
         * espelho no estágio da origem, com as datas REAIS de entrada —
         * sem E0, sem card de Workspace, sem cadência nova.
         */
        const normalized = normalizeGreenSalesLead(raw as never);
        const rawTags = Array.isArray(raw["tags"])
          ? (raw["tags"] as { id: number | string }[])
          : [];
        const { stage, remarketing } = resolveBoardStage(
          pipeline,
          rawTags.map((t) => String(t.id)),
        );
        const forms = Array.isArray(raw["forms"]) ? (raw["forms"] as { title?: string }[]) : [];
        const lastEntryAt =
          (raw["last_register_at"] as string) ??
          (raw["register"] as string) ??
          (raw["created_at"] as string) ??
          null;
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
        if (outcome.deduplicated) summary.duplicatesAvoided += 1;
        else if (outcome.created) {
          summary.created += 1;
          summary.recovered += 1;
        } else if (outcome.changed) summary.updated += 1;
        continue;
      }

      /**
       * CASOS A e C — CAMINHO ÚNICO DE ENTRADA (`intakeLead`): espelho →
       * card do Workspace → E0 → motor. Extraído sem mudança de
       * comportamento, para que o ambiente de teste percorra exatamente
       * este caminho.
       */
      const outcome = await intakeLead(raw, { pipeline, settings, connectionUserId });
      if (outcome.deduplicated) summary.duplicatesAvoided += 1;
      else if (outcome.created) summary.created += 1;
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
      // Mesma proteção da sincronização incremental: as etiquetas da
      // listagem (withs) prevalecem quando o detalhe não as traz.
      if (!Array.isArray(raw["tags"]) || (raw["tags"] as unknown[]).length === 0) {
        raw["tags"] = (listed as { tags?: unknown[] }).tags ?? [];
      }
      if (!Array.isArray(raw["forms"]) || (raw["forms"] as unknown[]).length === 0) {
        raw["forms"] = (listed as { forms?: unknown[] }).forms ?? [];
      }
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
    const reconciled = await reconcileMissingLeads(
      page.leads.map((l) => String(l.id)),
      page.completeness,
    );
    if (reconciled.aborted) {
      summary.errors.push(
        `Reconciliação de NÃO LOCALIZADOS abortada: ${reconciled.abortReason ?? "varredura incompleta"}. Nenhum estágio foi alterado.`,
      );
    } else if (reconciled.moved > 0) {
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
