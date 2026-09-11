/**
 * RF — RELACIONAMENTO ESFRIADO (SERVER ONLY, Financeira /f).
 *
 * Varredura própria, motor único. O RF não tem fila nova, agenda nova
 * nem scheduler independente: ele nasce como obrigação em
 * `relationship_queue` e é executado pela Ação do Dia, exatamente como
 * qualquer outra etapa.
 *
 * Por que uma varredura específica: `eligibleLeadIds()` só enxerga
 * cadência aberta, tarefa vencida ou E0 recente. Um lead cuja jornada
 * TERMINOU não aparece em nenhuma dessas listas — e é justamente ele o
 * público do RF. A varredura daqui parte da própria fila (últimas
 * execuções) e roda dentro do mesmo tique, com falha isolada.
 *
 * Idempotência: índice único da fila
 * `(scope, run_id, lead_id, step, action_order)` + `action_order` =
 * número da JORNADA. Repetir a sincronização da mesma jornada não cria
 * RF novo; uma jornada nova (seq maior) tem direito ao próprio RF sem
 * tocar nos RFs históricos.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  RF_ACTIVATION_AT,
  RF_FLOW,
  RF0_DELAY_DAYS,
  RF0_STEP,
  RF1_STEP,
  decideColdRelationship,
  isRfStep,
  rfEventKey,
  type RfDecision,
  type RfInstanceFact,
  type RfQueueFact,
} from "@/lib/relationship/cold-relationship";
import { envNow } from "@/server/time/environment-clock.server";

const SCOPE = "production";
/** Teto de leads avaliados por tique — protege o tempo do ciclo. */
const BATCH = 150;

export type ColdRelationshipSummary = {
  evaluated: number;
  scheduled: number;
  cancelled: number;
  skipped: number;
  errors: string[];
};

function daysAgo(nowIso: string, days: number): string {
  const at = new Date(nowIso);
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString();
}

/**
 * Leads candidatos ao RF:
 *   1. quem tem execução efetiva antiga o bastante (≥ 20 dias) e
 *      posterior à ativação da regra — sem backfill;
 *   2. quem já tem RF na fila (para avançar o RF1 ou cancelar pendente).
 */
async function candidateLeadIds(nowIso: string): Promise<string[]> {
  const ids = new Set<string>();

  const { data: executed } = await supabaseAdmin
    .from("relationship_queue")
    .select("lead_id,executed_at")
    .eq("scope", SCOPE)
    .is("run_id", null)
    .eq("status", "EXECUTED")
    .gte("executed_at", RF_ACTIVATION_AT)
    .lte("executed_at", daysAgo(nowIso, RF0_DELAY_DAYS))
    .order("executed_at", { ascending: false })
    .limit(1000);
  for (const row of executed ?? []) ids.add(row.lead_id as string);

  const { data: rfRows } = await supabaseAdmin
    .from("relationship_queue")
    .select("lead_id")
    .eq("scope", SCOPE)
    .is("run_id", null)
    .in("step", [RF0_STEP, RF1_STEP])
    .limit(1000);
  for (const row of rfRows ?? []) ids.add(row.lead_id as string);

  return Array.from(ids).slice(0, BATCH);
}

async function loadFacts(leadId: string) {
  const [queue, cadences, lead, events, meetings] = await Promise.all([
    supabaseAdmin
      .from("relationship_queue")
      .select("id,step,action_order,status,due_at,executed_at")
      .eq("scope", SCOPE)
      .is("run_id", null)
      .eq("lead_id", leadId),
    supabaseAdmin
      .from("relationship_cadences")
      .select("instance_seq,active,started_at,ended_at")
      .eq("scope", SCOPE)
      .eq("lead_id", leadId),
    supabaseAdmin
      .from("portal_leads")
      .select("commercial_state")
      .eq("id", leadId)
      .maybeSingle(),
    supabaseAdmin
      .from("relationship_events")
      .select("occurred_at,step,type")
      .eq("scope", SCOPE)
      .eq("lead_id", leadId)
      .is("voided_at", null)
      .order("occurred_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("portal_meetings")
      .select("created_at,scheduled_at")
      .eq("investor_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const queueFacts: RfQueueFact[] = ((queue.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row["id"] ?? ""),
    step: String(row["step"] ?? ""),
    actionOrder: Number(row["action_order"] ?? 1),
    status: String(row["status"] ?? ""),
    dueAt: (row["due_at"] as string | null) ?? null,
    executedAt: (row["executed_at"] as string | null) ?? null,
  }));

  const instances: RfInstanceFact[] = ((cadences.data ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      instanceSeq: Number(row["instance_seq"] ?? 1),
      active: Boolean(row["active"]),
      startedAt: (row["started_at"] as string | null) ?? null,
      endedAt: (row["ended_at"] as string | null) ?? null,
    }),
  );

  // Eventos do próprio RF não contam como evolução do investidor.
  const latestEventAt =
    ((events.data ?? []) as Record<string, unknown>[]).find(
      (row) => !isRfStep(row["step"] as string | null),
    )?.["occurred_at"] as string | undefined;

  const meetingRow = ((meetings.data ?? []) as Record<string, unknown>[])[0];

  return {
    queue: queueFacts,
    instances,
    evolution: {
      stageKey: ((lead.data as Record<string, unknown> | null)?.["commercial_state"] as
        | string
        | null) ?? null,
      latestEventAt: latestEventAt ?? null,
      latestMeetingAt: (meetingRow?.["created_at"] as string | null) ?? null,
    },
  };
}

async function recordDecision(leadId: string, decision: RfDecision, at: string): Promise<void> {
  const step = decision.kind === "none" ? null : decision.step;
  await supabaseAdmin.from("relationship_decisions").insert({
    scope: SCOPE,
    run_id: null,
    lead_id: leadId,
    decided_at: at,
    step,
    flow: RF_FLOW,
    state_before: "JORNADA_ENCERRADA",
    state_after: decision.kind === "schedule" ? "RF_AGENDADO" : "RF_INELEGIVEL",
    outcome: decision.kind === "schedule" ? "scheduled" : "blocked",
    reason: decision.reason,
  } as never);
}

/**
 * Aplica a decisão do RF de um lead. Nunca apaga nem reescreve nada:
 * agendar é INSERT, cancelar é marcar a linha existente como CANCELLED
 * com motivo.
 */
async function applyDecision(
  leadId: string,
  decision: RfDecision,
  facts: Awaited<ReturnType<typeof loadFacts>>,
  nowIso: string,
): Promise<"scheduled" | "cancelled" | "skipped"> {
  if (decision.kind === "none") return "skipped";

  if (decision.kind === "cancel") {
    const rows = facts.queue.filter(
      (row) =>
        row.step.trim().toUpperCase() === decision.step &&
        Number(row.actionOrder) === decision.journeySeq &&
        (row.status === "PENDING" || row.status === "PROCESSING"),
    );
    for (const row of rows) {
      if (!row.id) continue;
      await supabaseAdmin
        .from("relationship_queue")
        .update({
          status: "CANCELLED",
          reason: decision.reason,
          cancel_reason: decision.reason,
          updated_at: nowIso,
        } as never)
        .eq("id", row.id)
        .eq("scope", SCOPE);
    }
    await recordDecision(leadId, decision, nowIso);
    return "cancelled";
  }

  // Idempotência do evento: mesma jornada nunca registra o RF duas vezes.
  const { error: eventError } = await supabaseAdmin.from("relationship_events").insert({
    scope: SCOPE,
    lead_id: leadId,
    event_key: rfEventKey(leadId, decision.step, decision.journeySeq),
    type: "COLD_RELATIONSHIP_SCHEDULED",
    step: decision.step,
    occurred_at: nowIso,
    historical: false,
    data: {
      journeySeq: decision.journeySeq,
      referenceAt: decision.referenceAt,
      dueAt: decision.dueAt,
      reason: decision.reason,
    },
  } as never);
  if (eventError) return "skipped"; // já registrado nesta jornada

  const { error } = await supabaseAdmin.from("relationship_queue").insert({
    scope: SCOPE,
    run_id: null,
    lead_id: leadId,
    flow: RF_FLOW,
    step: decision.step,
    due_at: decision.dueAt,
    priority: 5,
    status: "PENDING",
    attempts: 0,
    // A ORDEM CARREGA A JORNADA: RF de jornadas diferentes coexistem.
    action_order: decision.journeySeq,
    action_kind: "message",
    reason: decision.reason,
  } as never);
  if (error) return "skipped"; // índice único = RF já existe nesta jornada

  await recordDecision(leadId, decision, nowIso);
  return "scheduled";
}

/** Varredura do RF. Falha de um lead nunca interrompe os demais. */
export async function runColdRelationshipTick(
  nowIso?: string,
): Promise<ColdRelationshipSummary> {
  const at = nowIso ?? envNow().toISOString();
  const summary: ColdRelationshipSummary = {
    evaluated: 0,
    scheduled: 0,
    cancelled: 0,
    skipped: 0,
    errors: [],
  };

  /* Conteúdo oficial do RF precisa existir antes de qualquer obrigação. */
  try {
    const { ensureColdRelationshipLibrary } = await import("./message-library.server");
    await ensureColdRelationshipLibrary();
  } catch (error) {
    summary.errors.push(
      `Biblioteca RF: ${error instanceof Error ? error.message : "falha desconhecida"}`,
    );
  }

  const leadIds = await candidateLeadIds(at);
  for (const leadId of leadIds) {
    try {
      const facts = await loadFacts(leadId);
      const decision = decideColdRelationship({ nowIso: at, ...facts });
      const applied = await applyDecision(leadId, decision, facts, at);
      summary.evaluated += 1;
      if (applied === "scheduled") summary.scheduled += 1;
      else if (applied === "cancelled") summary.cancelled += 1;
      else summary.skipped += 1;
    } catch (error) {
      if (summary.errors.length < 20) {
        summary.errors.push(
          `Lead ${leadId}: ${error instanceof Error ? error.message : "falha desconhecida"}`,
        );
      }
    }
  }
  return summary;
}
