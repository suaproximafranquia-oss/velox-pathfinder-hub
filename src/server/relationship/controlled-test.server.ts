/**
 * VALIDAÇÃO TEMPORAL CONTROLADA — somente Central de Homologação /f.
 *
 * A rodada usa as tabelas já existentes com `scope=homologation` e um
 * `run_id` próprio. Os quatro cadastros reais são apenas identidades de
 * leitura: nenhuma linha de produção, CRM, Portal ou mensagem é alterada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createVirtualClock, type EngineClock } from "@/lib/relationship/clock";
import { createEngine, type Engine } from "@/lib/relationship/engine";
import { initialRecord } from "@/lib/relationship/machine";
import type { DailyAction } from "@/lib/crm/daily-actions";
import { normalizeDailyActions, operationalDate } from "@/lib/crm/daily-actions";
import type { EngineDispatcher } from "@/lib/relationship/ports";
import { RELATIONSHIP_CONFIG } from "@/lib/relationship/config";
import { createRepository } from "./repository.server";
import { resolveCyclePlan } from "./flow-versions.server";
import { loadCadenceV2State } from "./cadence-v2-state.server";
import { stepDisplayLabel } from "@/lib/relationship/step-labels";

export const CONTROLLED_TEST_KIND = "controlled_real_clock";
export const CONTROLLED_TEST_FACTOR = 288;
export const CONTROLLED_LEADS = [
  { crmId: "f37a216b-816e-4d5c-8083-40635b523735", externalId: "59034", leadId: "gs_59034", name: "Ricardo Gonçalves", suffix: "6548" },
  { crmId: "82698d70-fad5-4959-88f1-49250fa9c1a8", externalId: "59037", leadId: "gs_59037", name: "Eduardo Franco", suffix: "2350" },
  { crmId: "36a0dded-7a64-4845-9c3c-e0d3333832d2", externalId: "59081", leadId: "gs_59081", name: "Francisco", suffix: "1074" },
  { crmId: "96d1cc08-3078-477e-b445-fb791bec76e9", externalId: "59279", leadId: "gs_59279", name: "João Figueiredo", suffix: "7062" },
] as const;

const ALLOWED_IDS = new Set<string>(CONTROLLED_LEADS.map((lead) => lead.leadId));
type Row = Record<string, any>;

export type ControlledTestStatus = {
  active: boolean;
  runId: string | null;
  realNowIso: string;
  logicalNowIso: string;
  factor: number;
  leads: Array<{ leadId: string; name: string; phoneSuffix: string }>;
  counts: { cadences: number; queue: number; events: number; decisions: number };
};

function assertAllowedLead(leadId: string): void {
  if (!ALLOWED_IDS.has(leadId)) throw new Error("Lead fora da seleção fechada da validação controlada.");
}

async function verifyIdentities(): Promise<ControlledTestStatus["leads"]> {
  const crmIds = CONTROLLED_LEADS.map((lead) => lead.crmId);
  const { data, error } = await supabaseAdmin
    .from("crm_leads")
    .select("id,external_id,name,phone,external_source,is_test")
    .in("id", crmIds);
  if (error) throw new Error(error.message);
  const byId = new Map(((data ?? []) as Row[]).map((row) => [String(row.id), row]));
  return CONTROLLED_LEADS.map((expected) => {
    const row = byId.get(expected.crmId);
    const digits = String(row?.phone ?? "").replace(/\D/g, "");
    if (
      !row ||
      row.external_id !== expected.externalId ||
      row.external_source !== "greensales" ||
      Boolean(row.is_test) ||
      String(row.name ?? "").trim() !== expected.name ||
      !digits.endsWith(expected.suffix)
    ) {
      throw new Error(`Identidade divergente para ${expected.name}; ativação bloqueada.`);
    }
    return { leadId: expected.leadId, name: expected.name, phoneSuffix: expected.suffix };
  });
}

async function activeBatch(): Promise<Row | null> {
  const { data, error } = await supabaseAdmin
    .from("test_batches")
    .select("id,status,kind,scenarios,created_at,started_at,ends_at")
    .eq("kind", CONTROLLED_TEST_KIND)
    .eq("status", "ATIVO")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Row | null) ?? null;
}

function clockFor(batch: Row, realNow: () => Date = () => new Date()): EngineClock {
  return createVirtualClock(
    {
      startedAtReal: String(batch.created_at),
      startedAtVirtual: String(batch.started_at),
      frozenAtVirtual: batch.ends_at ? String(batch.ends_at) : null,
      factor: CONTROLLED_TEST_FACTOR,
    },
    realNow,
  );
}

async function counts(runId: string | null): Promise<ControlledTestStatus["counts"]> {
  if (!runId) return { cadences: 0, queue: 0, events: 0, decisions: 0 };
  const tables = ["relationship_cadences", "relationship_queue", "relationship_events", "relationship_decisions"] as const;
  const values = await Promise.all(tables.map(async (table) => {
    const { count } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true })
      .eq("scope", "homologation").eq("run_id", runId);
    return count ?? 0;
  }));
  return { cadences: values[0], queue: values[1], events: values[2], decisions: values[3] };
}

export async function controlledTestStatus(): Promise<ControlledTestStatus> {
  const batch = await activeBatch();
  const realNowIso = new Date().toISOString();
  const leads = await verifyIdentities();
  return {
    active: Boolean(batch),
    runId: batch ? String(batch.id) : null,
    realNowIso,
    logicalNowIso: batch ? clockFor(batch).nowIso() : realNowIso,
    factor: CONTROLLED_TEST_FACTOR,
    leads,
    counts: await counts(batch ? String(batch.id) : null),
  };
}

const homologationDispatcher: EngineDispatcher = {
  scope: "homologation",
  assertRecipientAllowed: async (leadId) => {
    if (!ALLOWED_IDS.has(leadId)) return { ok: false, reason: "Lead fora da seleção controlada." };
    return { ok: true };
  },
  send: async (request) => {
    assertAllowedLead(request.leadId);
    return { delivered: true, externalId: `homologation:${request.leadId}:${request.step}` };
  },
};

function engineFor(runId: string, clock: EngineClock): Engine {
  return createEngine({
    repository: createRepository("homologation", runId),
    dispatcher: homologationDispatcher,
    clock,
    config: RELATIONSHIP_CONFIG,
    enabled: true,
    virtualTemplates: true,
    flowPlan: (record) => resolveCyclePlan(record.flow, record.flowVersionId ?? null),
    v2State: (record) => loadCadenceV2State(record, { nowIso: clock.nowIso(), runId }),
  });
}

async function deleteRunRows(runId: string): Promise<void> {
  for (const table of ["relationship_queue", "relationship_decisions", "relationship_events", "relationship_cadences"] as const) {
    const { error } = await supabaseAdmin.from(table).delete().eq("scope", "homologation").eq("run_id", runId);
    if (error) throw new Error(error.message);
  }
}

export async function previewControlledTestCleanup(): Promise<ControlledTestStatus> {
  return controlledTestStatus();
}

export async function activateControlledTest(actorId: string, actorName: string): Promise<ControlledTestStatus> {
  await verifyIdentities();
  const existing = await activeBatch();
  if (existing) return controlledTestStatus();

  const realNow = new Date();
  const runId = `CONTROLLED-4-${realNow.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const logicalStart = new Date(realNow);
  logicalStart.setUTCHours(12, 0, 0, 0);
  const { error } = await supabaseAdmin.from("test_batches").insert({
    id: runId,
    label: "Validação temporal — 4 leads reais",
    scenarios: CONTROLLED_LEADS.map((lead) => lead.leadId) as never,
    notes: "Estado isolado em homologação. Cadastros de produção somente leitura.",
    status: "ATIVO",
    lead_count: CONTROLLED_LEADS.length,
    created_by: actorId,
    created_by_name: actorName,
    kind: CONTROLLED_TEST_KIND,
    seed: String(CONTROLLED_TEST_FACTOR),
    time_zone: "America/Sao_Paulo",
    started_at: logicalStart.toISOString(),
    ends_at: null,
  } as never);
  if (error) throw new Error(error.message);

  const repository = createRepository("homologation", runId);
  for (const lead of CONTROLLED_LEADS) {
    const record = initialRecord({ scope: "homologation", leadId: lead.leadId, runId, at: logicalStart.toISOString() });
    record.startedAt = logicalStart.toISOString();
    record.startedBy = "manual";
    record.state = "CADENCE_ACTIVE";
    record.currentStep = "E0";
    await repository.saveRecord(record);
  }
  await runControlledTestTick();
  return controlledTestStatus();
}

export async function runControlledTestTick(): Promise<ControlledTestStatus> {
  const batch = await activeBatch();
  if (!batch) throw new Error("Nenhuma rodada controlada ativa.");
  const scenarios = Array.isArray(batch.scenarios) ? batch.scenarios.map(String) : [];
  if (scenarios.length !== CONTROLLED_LEADS.length || scenarios.some((id: string) => !ALLOWED_IDS.has(id))) {
    throw new Error("Seleção da rodada divergente; execução bloqueada.");
  }
  const engine = engineFor(String(batch.id), clockFor(batch));
  for (const lead of CONTROLLED_LEADS) await engine.tick(lead.leadId);
  return controlledTestStatus();
}

export async function controlledTestActions(): Promise<{ status: ControlledTestStatus; actions: DailyAction[] }> {
  const status = await controlledTestStatus();
  if (!status.active || !status.runId) return { status, actions: [] };
  const { data, error } = await supabaseAdmin
    .from("relationship_queue")
    .select("id,lead_id,flow,step,due_at,status,action_order,action_kind")
    .eq("scope", "homologation")
    .eq("run_id", status.runId)
    .in("lead_id", CONTROLLED_LEADS.map((lead) => lead.leadId))
    .in("status", ["PENDING", "PROCESSING"])
    .lte("due_at", status.logicalNowIso)
    .order("due_at", { ascending: true });
  if (error) throw new Error(error.message);
  const identities = new Map<string, (typeof CONTROLLED_LEADS)[number]>(
    CONTROLLED_LEADS.map((lead) => [lead.leadId, lead]),
  );
  const actions = ((data ?? []) as Row[]).map((row) => {
    assertAllowedLead(String(row.lead_id));
    const lead = identities.get(String(row.lead_id));
    const order = Number(row.action_order ?? 1);
    const isCall = row.action_kind === "call";
    const dueDate = operationalDate(String(row.due_at));
    const overdue = dueDate < operationalDate(status.logicalNowIso);
    return {
      actionKey: `queue:${row.lead_id}:${row.flow}-${row.step}-${order}:${row.id}`,
      source: "queue",
      kind: isCall ? "ligacao" : "mensagem",
      leadId: String(row.lead_id),
      name: lead?.name ?? "Investidor",
      phone: "",
      scope: "homologation",
      stepLabel: stepDisplayLabel(String(row.step)),
      dueDate,
      startsAt: null,
      endsAt: null,
      overdue,
      priorityMax: row.step === "E0",
      bucket: overdue ? "atrasada" : "hoje",
      title: isCall ? (order > 1 ? `Segunda ligação — Etapa ${row.step}` : `Ligação — Etapa ${row.step}`) : `Copiar mensagem — Etapa ${row.step}`,
      responsibleName: null,
      attempts: [],
      claimed: row.status === "PROCESSING",
      queueItemId: String(row.id),
      queueActionOrder: order,
      ...(isCall ? {} : { messageRef: { step: String(row.step), flow: String(row.flow), origin: "queue" as const } }),
    } satisfies DailyAction;
  });
  return { status, actions: normalizeDailyActions(actions) };
}

export async function concludeControlledAction(input: { queueItemId: string; outcome?: "SIM" | "NAO" }): Promise<{ ok: boolean; status: ControlledTestStatus; actions: DailyAction[] }> {
  const batch = await activeBatch();
  if (!batch) throw new Error("Nenhuma rodada controlada ativa.");
  const runId = String(batch.id);
  const clock = clockFor(batch);
  const { data: item } = await supabaseAdmin.from("relationship_queue")
    .select("id,lead_id,step,action_kind,status").eq("id", input.queueItemId)
    .eq("scope", "homologation").eq("run_id", runId).maybeSingle();
  if (!item) throw new Error("Ação fora da rodada controlada.");
  assertAllowedLead(String(item.lead_id));
  const engine = engineFor(runId, clock);
  if (item.action_kind === "call") {
    const { registerQueueCallOutcome } = await import("./call-outcome.server");
    const result = await registerQueueCallOutcome({
      queueItemId: String(item.id), outcome: input.outcome ?? "NAO", actorId: "homologation", nowIso: clock.nowIso(), engine,
    });
    if (!result.concluded) return { ok: false, ...(await controlledTestActions()) };
  } else {
    await engine.confirmManualExecution({ leadId: String(item.lead_id), step: String(item.step), queueItemId: String(item.id) });
  }
  return { ok: true, ...(await controlledTestActions()) };
}

export async function deactivateControlledTest(): Promise<ControlledTestStatus> {
  const batch = await activeBatch();
  if (!batch) return controlledTestStatus();
  const runId = String(batch.id);
  const frozenAt = clockFor(batch).nowIso();
  const { error } = await supabaseAdmin.from("test_batches")
    .update({ status: "ENCERRADO", ends_at: frozenAt } as never).eq("id", runId).eq("status", "ATIVO");
  if (error) throw new Error(error.message);
  await deleteRunRows(runId);
  return controlledTestStatus();
}
