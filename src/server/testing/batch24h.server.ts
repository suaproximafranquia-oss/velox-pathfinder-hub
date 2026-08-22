/**
 * TESTE CONTROLADO DE ENTRADA — 24 HORAS (SERVER ONLY).
 *
 * O que este arquivo FAZ:
 *  • reset FAIL-CLOSED dos artefatos de homologação (só o que possui
 *    marcação técnica inequívoca de teste);
 *  • criação de um lote com 9 leads fictícios programados ao longo de
 *    24 horas (3 tipos × 3 faixas de horário), com semente registrada;
 *  • execução dos eventos no horário programado, pelo CAMINHO ÚNICO de
 *    ingestão (`intakeLead`) e pelo motor real;
 *  • auditoria: entrada real, janela naquele momento, E0 executada ou
 *    adiada, horário efetivo e motivo.
 *
 * O que este arquivo NÃO FAZ:
 *  • não cria um segundo motor de relacionamento ou de cadência;
 *  • não chama a Meta, o WhatsApp real ou o GreenSales real;
 *  • não apaga, move ou marca nenhum lead real.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BATCH_24H_KIND,
  ENTRY_TYPE_LABEL,
  SLOT_LABEL,
  TEST_TIME_ZONE,
  buildBatch24hId,
  buildBatch24hPayload,
  isSyntheticRecipient,
  localParts,
  planBatch24h,
  rebuildPlannedEvent,
  type EntryType,
  type PlannedEvent,
  type TimeSlot,
} from "@/lib/testing/batch24h";
import { isE0NightWindow, nextE0Moment } from "@/lib/crm/e0-window";
import { RELATIONSHIP_CONFIG } from "@/lib/relationship/config";
import { loadSettings } from "@/server/crm/automation.server";
import { intakeLead } from "@/server/crm/lead-intake.server";
import {
  DEFAULT_PIPELINE_EXTERNAL_ID,
  ENTRY_STAGE_KEY,
  loadPipeline,
} from "@/server/crm/pipeline-service.server";
import { ensureWorkspaceCard } from "@/server/crm/workspace-card.server";
import { logEngineAction } from "@/server/relationship/engine.server";

/** Leads reais que jamais podem constar como candidatos (auditoria). */
const NEVER_DELETE_CARD_IDS = new Set(["ld_msy1onox18t1"]);

/* ------------------------------------------------------------------ */
/* §1–§2 — RESET FAIL-CLOSED                                           */
/* ------------------------------------------------------------------ */

export type ResetReport = {
  status: "EXECUTADO" | "SIMULADO" | "BLOQUEADO";
  blockReason: string | null;
  candidatesFound: number;
  fictitiousConfirmed: number;
  preservedRecords: number;
  removedRecords: number;
  affectedTables: string[];
  totalRemoved: number;
  totalPreserved: number;
  leads: { id: string; name: string; batchId: string | null }[];
};

type Mirror = { id: string; external_id: string; name: string; is_test: boolean | null; test_batch_id: string | null };
type Card = { id: string; name: string; is_test: boolean | null; test_batch_id: string | null };

/**
 * Candidatos = SOMENTE registros com marcação técnica de teste
 * (`is_test = true` + `test_batch_id` preenchido). Nome, telefone,
 * e-mail, cidade, coluna e data JAMAIS classificam um lead.
 */
async function collectCandidates(): Promise<{
  mirrors: Mirror[];
  cards: Card[];
  blockReason: string | null;
  preserved: number;
}> {
  const { data: mirrorRows } = await supabaseAdmin
    .from("crm_leads")
    .select("id,external_id,name,is_test,test_batch_id")
    .eq("is_test", true);
  const { data: cardRows } = await supabaseAdmin
    .from("portal_leads")
    .select("id,name,is_test,test_batch_id")
    .eq("is_test", true);
  const { count: totalMirrors } = await supabaseAdmin
    .from("crm_leads")
    .select("*", { count: "exact", head: true });
  const { count: totalCards } = await supabaseAdmin
    .from("portal_leads")
    .select("*", { count: "exact", head: true });

  const mirrors = (mirrorRows ?? []) as Mirror[];
  const cards = (cardRows ?? []) as Card[];

  let blockReason: string | null = null;
  const invalidMirror = mirrors.find((m) => m.is_test !== true || !m.test_batch_id);
  const invalidCard = cards.find((c) => c.is_test !== true || !c.test_batch_id);
  if (invalidMirror) {
    blockReason = `Registro sem identificação completa de teste (${invalidMirror.external_id}) — reset abortado.`;
  } else if (invalidCard) {
    blockReason = `Card sem identificação completa de teste (${invalidCard.id}) — reset abortado.`;
  }
  const realLeak = cards.find((c) => NEVER_DELETE_CARD_IDS.has(c.id));
  if (realLeak) blockReason = `Lead real (${realLeak.id}) apareceu entre os candidatos — reset abortado.`;

  const preserved = (totalMirrors ?? 0) - mirrors.length + ((totalCards ?? 0) - cards.length);
  return { mirrors, cards, blockReason, preserved };
}

export async function resetHomologation(options: { dryRun: boolean }): Promise<ResetReport> {
  const { mirrors, cards, blockReason, preserved } = await collectCandidates();
  const cardIds = Array.from(new Set([...cards.map((c) => c.id), ...mirrors.map((m) => `gs_${m.external_id}`)]));
  const mirrorIds = mirrors.map((m) => m.id);
  const candidates = mirrors.length + cards.length;
  const leads = [
    ...mirrors.map((m) => ({ id: m.external_id, name: m.name, batchId: m.test_batch_id })),
    ...cards.map((c) => ({ id: c.id, name: c.name, batchId: c.test_batch_id })),
  ];

  if (blockReason) {
    return {
      status: "BLOQUEADO",
      blockReason,
      candidatesFound: candidates,
      fictitiousConfirmed: 0,
      preservedRecords: preserved,
      removedRecords: 0,
      affectedTables: [],
      totalRemoved: 0,
      totalPreserved: preserved + candidates,
      leads,
    };
  }

  if (options.dryRun) {
    return {
      status: "SIMULADO",
      blockReason: null,
      candidatesFound: candidates,
      fictitiousConfirmed: candidates,
      preservedRecords: preserved,
      removedRecords: 0,
      affectedTables: [],
      totalRemoved: 0,
      totalPreserved: preserved + candidates,
      leads,
    };
  }

  const affected: string[] = [];
  let removed = 0;
  if (cardIds.length > 0) {
    for (const table of [
      "relationship_queue",
      "relationship_decisions",
      "relationship_events",
      "relationship_cadences",
    ]) {
      await supabaseAdmin.from(table).delete().in("lead_id" as never, cardIds as never);
      affected.push(table);
    }
    for (const table of ["crm_messages", "crm_timeline", "portal_journey_events", "portal_engagement"]) {
      await supabaseAdmin.from(table).delete().in("investor_id" as never, cardIds as never);
      affected.push(table);
    }
    const { count } = await supabaseAdmin
      .from("portal_leads")
      .delete({ count: "exact" })
      .eq("is_test", true)
      .in("id", cardIds);
    removed += count ?? 0;
    affected.push("portal_leads");
  }
  if (mirrorIds.length > 0) {
    await supabaseAdmin.from("crm_cadence_tasks").delete().in("lead_id", mirrorIds);
    await supabaseAdmin.from("crm_lead_events").delete().in("lead_id", mirrorIds);
    const { count } = await supabaseAdmin
      .from("crm_leads")
      .delete({ count: "exact" })
      .eq("is_test", true)
      .in("id", mirrorIds);
    removed += count ?? 0;
    affected.push("crm_cadence_tasks", "crm_lead_events", "crm_leads");
  }
  // Os lotes permanecem para auditoria (§25); apenas mudam de situação.
  await supabaseAdmin
    .from("test_batches")
    .update({ status: "LIMPO", lead_count: 0 } as never)
    .neq("status", "LIMPO");
  affected.push("test_batches");

  await logEngineAction("reset_homologacao_24h", { candidatos: candidates, removidos: removed });

  return {
    status: "EXECUTADO",
    blockReason: null,
    candidatesFound: candidates,
    fictitiousConfirmed: candidates,
    preservedRecords: preserved,
    removedRecords: removed,
    affectedTables: Array.from(new Set(affected)),
    totalRemoved: removed,
    totalPreserved: preserved,
    leads,
  };
}

/* ------------------------------------------------------------------ */
/* §3–§5 — CRIAÇÃO DO LOTE                                             */
/* ------------------------------------------------------------------ */

export type CreateBatch24hResult = {
  ok: boolean;
  batchId: string;
  seed: string;
  events: {
    position: number;
    entryType: EntryType;
    slot: TimeSlot;
    externalId: string;
    name: string;
    scheduledAt: string;
  }[];
  error?: string;
};

export async function createBatch24h(input: {
  createdBy?: string | null;
  createdByName?: string;
  seed?: string | null;
}): Promise<CreateBatch24hResult> {
  const now = new Date();
  const batchId = buildBatch24hId(now);
  const seed = input.seed?.trim() || `${batchId}-${Math.floor(Math.random() * 1_000_000)}`;

  const { data: existing } = await supabaseAdmin
    .from("test_batches")
    .select("id")
    .eq("id", batchId)
    .maybeSingle();
  if (existing) {
    return { ok: false, batchId, seed, events: [], error: "Já existe um lote com este identificador." };
  }

  const planned = planBatch24h(batchId, seed, now);
  const invalid = planned.find((p) => !isSyntheticRecipient(p));
  if (invalid) {
    return { ok: false, batchId, seed, events: [], error: "Destinatário não fictício detectado — lote recusado." };
  }

  await supabaseAdmin.from("test_batches").insert({
    id: batchId,
    label: `Teste de Entrada 24h — ${batchId}`,
    kind: BATCH_24H_KIND,
    scenarios: ["greensales", "portal", "reentrada"] as never,
    notes: "Teste controlado de entrada em 24 horas (madrugada, janela aberta e pós-fechamento).",
    seed,
    time_zone: TEST_TIME_ZONE,
    started_at: now.toISOString(),
    ends_at: new Date(now.getTime() + 24 * 3_600_000).toISOString(),
    lead_count: planned.length,
    status: "PROGRAMADO",
    created_by: input.createdBy ?? null,
    created_by_name: input.createdByName ?? "sistema",
  } as never);

  await supabaseAdmin.from("test_batch_events").insert(
    planned.map((p) => ({
      batch_id: batchId,
      entry_type: p.entryType,
      slot: p.slot,
      position: p.position,
      external_id: p.externalId,
      lead_name: p.name,
      scheduled_at: p.scheduledAt,
      status: "PENDENTE",
    })) as never,
  );

  await logEngineAction("lote_teste_24h_criado", { batchId, seed, eventos: planned.length });

  return {
    ok: true,
    batchId,
    seed,
    events: planned.map((p) => ({
      position: p.position,
      entryType: p.entryType,
      slot: p.slot,
      externalId: p.externalId,
      name: p.name,
      scheduledAt: p.scheduledAt,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* §15 — WORKER PERSISTENTE (roda no servidor, junto do cron do CRM)   */
/* ------------------------------------------------------------------ */

type EventRow = {
  id: string;
  batch_id: string;
  entry_type: EntryType;
  slot: TimeSlot;
  position: number;
  external_id: string;
  lead_name: string;
  scheduled_at: string;
  status: string;
};

export type TickResult = { executed: number; skipped: number; errors: string[] };

export async function runBatch24hTick(): Promise<TickResult> {
  const result: TickResult = { executed: 0, skipped: 0, errors: [] };
  const nowIso = new Date().toISOString();

  const { data: dueRows } = await supabaseAdmin
    .from("test_batch_events")
    .select("*")
    .eq("status", "PENDENTE")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(5);
  const due = (dueRows ?? []) as EventRow[];
  if (due.length === 0) return result;

  const pipeline = await loadPipeline(DEFAULT_PIPELINE_EXTERNAL_ID);
  if (!pipeline) {
    result.errors.push("Funil operacional não encontrado.");
    return result;
  }
  const entry = pipeline.stages.find((s) => s.key === ENTRY_STAGE_KEY);
  const historyStage = pipeline.stages.find((s) => s.key !== ENTRY_STAGE_KEY) ?? entry;
  if (!entry || !historyStage) {
    result.errors.push("Colunas do funil não encontradas.");
    return result;
  }
  const settings = await loadSettings();

  for (const row of due) {
    // Trava de concorrência/idempotência: só executa quem conseguir
    // mover o evento de PENDENTE para EXECUTANDO.
    const { data: claimed } = await supabaseAdmin
      .from("test_batch_events")
      .update({ status: "EXECUTANDO" } as never)
      .eq("id", row.id)
      .eq("status", "PENDENTE")
      .select("id");
    if (!claimed || claimed.length === 0) {
      result.skipped += 1;
      continue;
    }

    const lead = rebuildPlannedEvent(row);
    if (!isSyntheticRecipient(lead)) {
      await supabaseAdmin
        .from("test_batch_events")
        .update({
          status: "BLOQUEADO",
          error: "TESTE BLOQUEADO — destinatário não fictício.",
        } as never)
        .eq("id", row.id);
      result.errors.push(`${row.external_id}: destinatário não fictício.`);
      continue;
    }

    const entryAt = new Date().toISOString();
    const windowOpen = !isE0NightWindow(entryAt);
    try {
      if (row.entry_type === "reentrada") {
        await seedReentryHistory(lead, historyStage.externalTag, pipeline, settings, row.batch_id);
      }
      if (row.entry_type === "portal") {
        await registerPortalJourney(lead);
      }

      const outcome = await intakeLead(
        buildBatch24hPayload(lead, entry.externalTag, entryAt),
        {
          pipeline,
          settings,
          test: { batchId: row.batch_id },
          entryOrigin: row.entry_type === "portal" ? "PORTAL" : "GREENSALES",
        },
      );

      // §22 — reprocessamento deliberado de parte dos eventos.
      let idempotency: string | null = null;
      if (row.position % 3 === 0) {
        const before = await countArtifacts(outcome.cardId ?? `gs_${lead.externalId}`);
        await intakeLead(buildBatch24hPayload(lead, entry.externalTag, entryAt), {
          pipeline,
          settings,
          test: { batchId: row.batch_id },
          entryOrigin: row.entry_type === "portal" ? "PORTAL" : "GREENSALES",
        });
        const after = await countArtifacts(outcome.cardId ?? `gs_${lead.externalId}`);
        idempotency =
          before.messages === after.messages && before.cards === after.cards
            ? "Reprocessamento detectado — nenhuma duplicação criada."
            : `ATENÇÃO: duplicação detectada (mensagens ${before.messages}→${after.messages}).`;
      }

      const reason = [
        `Entrada às ${localHhmm(entryAt)} (${SLOT_LABEL[row.slot]}, ${ENTRY_TYPE_LABEL[row.entry_type]}).`,
        windowOpen
          ? `Janela E0 aberta (${hoursLabel()}). Execução imediata.`
          : `Janela E0 fechada (${hoursLabel()}). E0 preservada; execução prevista para ${localHhmm(nextE0Moment(entryAt))}.`,
        outcome.e0Reason ?? "",
        idempotency ?? "",
      ]
        .filter(Boolean)
        .join(" ");

      await supabaseAdmin
        .from("test_batch_events")
        .update({
          status: outcome.failed ? "ERRO" : "EXECUTADO",
          created_lead_at: entryAt,
          executed_at: new Date().toISOString(),
          e0_result: outcome.e0,
          e0_reason: reason,
          card_id: outcome.cardId,
          error: outcome.error ?? null,
        } as never)
        .eq("id", row.id);
      result.executed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha desconhecida";
      await supabaseAdmin
        .from("test_batch_events")
        .update({ status: "ERRO", error: message } as never)
        .eq("id", row.id);
      result.errors.push(`${row.external_id}: ${message}`);
    }
  }

  return result;
}

function hoursLabel(): string {
  const { start, end } = RELATIONSHIP_CONFIG.e0Hours;
  const fmt = (v: number) =>
    `${String(Math.floor(v)).padStart(2, "0")}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`;
  return `${fmt(start)}–${fmt(end)}, todos os dias`;
}

function localHhmm(iso: string): string {
  const { minutes } = localParts(new Date(iso));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

async function countArtifacts(cardId: string): Promise<{ messages: number; cards: number }> {
  const { count: messages } = await supabaseAdmin
    .from("crm_messages")
    .select("*", { count: "exact", head: true })
    .eq("investor_id", cardId);
  const { count: cards } = await supabaseAdmin
    .from("portal_leads")
    .select("*", { count: "exact", head: true })
    .eq("id", cardId);
  return { messages: messages ?? 0, cards: cards ?? 0 };
}

/**
 * §11 — HISTÓRICO ANTERIOR REAL PARA A REENTRADA.
 *
 * O lead é criado com entrada comercial ANTIGA em uma coluna que não é
 * NOVOS (por isso nenhuma E0 acontece), recebe um card marcado como
 * teste e duas mensagens fictícias de relacionamento. Quando a nova
 * entrada chegar, o sistema encontrará "lead conhecido + nova entrada
 * comercial" e classificará como REENTRADA → RE0.
 */
async function seedReentryHistory(
  lead: PlannedEvent,
  historyTag: string,
  pipeline: Awaited<ReturnType<typeof loadPipeline>>,
  settings: Awaited<ReturnType<typeof loadSettings>>,
  batchId: string,
): Promise<void> {
  if (!pipeline) return;
  const oldIso = new Date(Date.now() - 45 * 86_400_000).toISOString();
  await intakeLead(
    buildBatch24hPayload({ ...lead }, historyTag, oldIso, { previousEntryIso: oldIso }),
    { pipeline, settings, test: { batchId }, entryOrigin: "GREENSALES" },
  );
  const card = await ensureWorkspaceCard({
    externalId: lead.externalId,
    name: lead.name,
    email: lead.email,
    whatsapp: lead.phone,
    city: lead.city,
    material: null,
    campaign: null,
    externalCreatedAt: oldIso,
    externalUpdatedAt: oldIso,
    rawPayload: { historico: true },
    isTest: true,
    testBatchId: batchId,
  });
  if (!card.ok) return;
  const rows = [
    {
      id: `msg_hist_out_${lead.externalId}`,
      investor_id: card.cardId,
      direction: "enviada",
      body: "[TESTE] Relacionamento anterior — contato do Executivo.",
      author_id: "sistema",
      author_name: "Histórico (teste)",
      at: oldIso,
    },
    {
      id: `msg_hist_in_${lead.externalId}`,
      investor_id: card.cardId,
      direction: "recebida",
      body: "[TESTE] Relacionamento anterior — resposta do investidor.",
      author_id: "teste",
      author_name: "Investidor (teste)",
      at: new Date(Date.now() - 44 * 86_400_000).toISOString(),
    },
  ];
  for (const row of rows) {
    const { data: exists } = await supabaseAdmin
      .from("crm_messages")
      .select("id")
      .eq("id", row.id)
      .maybeSingle();
    if (!exists) await supabaseAdmin.from("crm_messages").insert(row as never);
  }
}

/** §20 — a entrada pelo Portal registra a jornada no servidor. */
async function registerPortalJourney(lead: PlannedEvent): Promise<void> {
  await supabaseAdmin.from("portal_journey_events").insert({
    investor_id: `gs_${lead.externalId}`,
    event: "entrada_portal_teste",
    module: "manual",
    detail: `[TESTE] Entrada registrada pelo Portal do Investidor (${lead.externalId}).`,
    percent: 0,
  } as never);
}

/* ------------------------------------------------------------------ */
/* §17–§19 — RELATÓRIO DE AUDITORIA                                    */
/* ------------------------------------------------------------------ */

export type Batch24hRow = {
  externalId: string;
  name: string;
  entryType: EntryType;
  slot: TimeSlot;
  scheduledAt: string;
  createdLeadAt: string | null;
  executedAt: string | null;
  status: string;
  e0Result: string | null;
  e0Reason: string | null;
  cardId: string | null;
  windowAtEntry: "ABERTA" | "FECHADA" | null;
  cadenceState: string | null;
  cadenceFlow: string | null;
  currentStep: string | null;
  nextStep: string | null;
  nextDueAt: string | null;
  messages: number;
  error: string | null;
};

export type Batch24hReport = {
  batchId: string;
  status: string;
  seed: string | null;
  timeZone: string;
  startedAt: string | null;
  endsAt: string | null;
  planned: number;
  created: number;
  pending: number;
  processed: number;
  errors: number;
  e0Rule: string;
  otherStepsRule: string;
  rows: Batch24hRow[];
};

export async function listBatches24h(): Promise<
  { id: string; status: string; seed: string | null; startedAt: string | null; endsAt: string | null; leadCount: number }[]
> {
  const { data } = await supabaseAdmin
    .from("test_batches")
    .select("id,status,seed,started_at,ends_at,lead_count,kind")
    .eq("kind", BATCH_24H_KIND)
    .order("created_at", { ascending: false });
  return (data ?? []).map((b: Record<string, unknown>) => ({
    id: String(b["id"]),
    status: String(b["status"]),
    seed: (b["seed"] as string) ?? null,
    startedAt: (b["started_at"] as string) ?? null,
    endsAt: (b["ends_at"] as string) ?? null,
    leadCount: Number(b["lead_count"] ?? 0),
  }));
}

export async function readBatch24hReport(batchId: string): Promise<Batch24hReport | null> {
  const { data: batch } = await supabaseAdmin
    .from("test_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return null;
  const { data: eventRows } = await supabaseAdmin
    .from("test_batch_events")
    .select("*")
    .eq("batch_id", batchId)
    .order("scheduled_at", { ascending: true });
  const events = (eventRows ?? []) as (EventRow & {
    created_lead_at: string | null;
    executed_at: string | null;
    e0_result: string | null;
    e0_reason: string | null;
    card_id: string | null;
    error: string | null;
  })[];

  const rows: Batch24hRow[] = [];
  for (const event of events) {
    const cardId = event.card_id ?? `gs_${event.external_id}`;
    const { data: cadence } = await supabaseAdmin
      .from("relationship_cadences")
      .select("state,flow,current_step")
      .eq("scope", "production")
      .eq("lead_id", cardId)
      .maybeSingle();
    const { data: queue } = await supabaseAdmin
      .from("relationship_queue")
      .select("step,due_at")
      .eq("scope", "production")
      .eq("lead_id", cardId)
      .eq("status", "PENDING")
      .order("due_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { count: messages } = await supabaseAdmin
      .from("crm_messages")
      .select("*", { count: "exact", head: true })
      .eq("investor_id", cardId);

    rows.push({
      externalId: event.external_id,
      name: event.lead_name,
      entryType: event.entry_type,
      slot: event.slot,
      scheduledAt: event.scheduled_at,
      createdLeadAt: event.created_lead_at,
      executedAt: event.executed_at,
      status: event.status,
      e0Result: event.e0_result,
      e0Reason: event.e0_reason,
      cardId: event.card_id,
      windowAtEntry: event.created_lead_at
        ? isE0NightWindow(event.created_lead_at)
          ? "FECHADA"
          : "ABERTA"
        : null,
      cadenceState: cadence?.state ?? null,
      cadenceFlow: cadence?.flow ?? null,
      currentStep: cadence?.current_step ?? null,
      nextStep: queue?.step ?? null,
      nextDueAt: queue?.due_at ?? null,
      messages: messages ?? 0,
      error: event.error,
    });
  }

  const b = batch as Record<string, unknown>;
  return {
    batchId,
    status: String(b["status"]),
    seed: (b["seed"] as string) ?? null,
    timeZone: String(b["time_zone"] ?? TEST_TIME_ZONE),
    startedAt: (b["started_at"] as string) ?? null,
    endsAt: (b["ends_at"] as string) ?? null,
    rows,
    planned: events.length,
    created: rows.filter((r) => r.createdLeadAt).length,
    pending: rows.filter((r) => r.status === "PENDENTE").length,
    processed: rows.filter((r) => r.status === "EXECUTADO").length,
    errors: rows.filter((r) => r.status === "ERRO" || r.status === "BLOQUEADO").length,
    e0Rule: `E0/A0 — ${hoursLabel()} (exceção central: RELATIONSHIP_CONFIG.e0Hours).`,
    otherStepsRule:
      "E1/E3/E4/E12, V, R, RE e RF — dias úteis 07:00–22:30, sábado 07:00–12:00, domingo e feriados sem envio; etapa fora da janela é reagendada para a próxima abertura (nunca substituída pela seguinte).",
  };
}
