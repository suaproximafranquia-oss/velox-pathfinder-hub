/**
 * ESTADO PERSISTIDO DA RÉGUA V2 — SERVER ONLY (Financeira /f).
 *
 * A régua V2 é um módulo puro: ela não conhece banco. Este arquivo é a
 * única ponte entre o estado real (fila, ciclo, estágio, material) e o
 * planejador. Ele NÃO decide nada — apenas lê e traduz.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { v2FlowOf, type V2DecisionInput, type V2QueueAction } from "@/lib/relationship/cadence-v2-decide";
import type { CadenceRecord } from "@/lib/relationship/types";
import { localDateOf } from "@/lib/relationship/cadence-v2";

/** Estágios que congelam a cadência / liberam o fluxo R. */
type Row = Record<string, any>;

async function loadStageKey(leadId: string): Promise<string | null> {
  const externalId = leadId.startsWith("gs_") ? leadId.slice(3) : null;
  const query = supabaseAdmin.from("crm_leads").select("stage_key");
  const { data } = await (externalId
    ? query.eq("external_source", "greensales").eq("external_id", externalId)
    : query.eq("id", leadId)
  ).maybeSingle();
  return (data as Row | null)?.stage_key ?? null;
}

/**
 * MATERIAL: só é verdade quando existe REGISTRO ESTRUTURADO de envio.
 * Falar, prometer ou demonstrar interesse não conta, e nenhum texto de
 * conversa é interpretado.
 */
export async function loadMaterialState(leadId: string): Promise<{
  materialSent: boolean;
  materialRequested: boolean;
  materialRequestedAt: string | null;
  /** Instante da disponibilização formal (CONTENT_SENT), quando houver. */
  materialSentAt: string | null;
}> {
  const { data } = await supabaseAdmin
    .from("relationship_events")
    .select("type,occurred_at,data")
    .eq("scope", "production")
    .eq("lead_id", leadId)
    .in("type", ["CONTENT_SENT", "MATERIAL_REQUESTED"])
    .order("occurred_at", { ascending: true });

  let materialSent = false;
  let materialSentAt: string | null = null;
  let materialRequestedAt: string | null = null;
  for (const row of (data ?? []) as Row[]) {
    if (row.type === "CONTENT_SENT") {
      materialSent = true;
      if (!materialSentAt) materialSentAt = row.occurred_at ?? null;
    }
    if (row.type === "MATERIAL_REQUESTED" && !materialRequestedAt) {
      materialRequestedAt = row.occurred_at ?? null;
    }
  }

  return {
    materialSent,
    materialRequested: Boolean(materialRequestedAt) || materialSent,
    materialRequestedAt,
    materialSentAt,
  };
}

/**
 * Estado do ciclo para a régua V2. Devolve `null` quando o fluxo não é
 * governado pela V2 (visualização e relacionamento frio seguem como
 * estão) — nesse caso o motor mantém o comportamento anterior.
 */
/**
 * PRIMEIRO CONTATO JÁ EXECUTADO POR FORA DA FILA.
 *
 * A E0 passou a ser etapa real da régua V2, mas os leads que já tiveram
 * o primeiro contato registrado pelo caminho anterior não podem receber
 * uma nova E0. Nada é apagado: o histórico existente é apenas lido.
 */
async function loadE0Executed(leadId: string): Promise<boolean> {
  // Registros ANULADOS (`voided_at`) são histórico: não contam como E0 feita.
  const { data } = await supabaseAdmin
    .from("workspace_e0_actions")
    .select("state")
    .eq("card_id", leadId)
    .eq("state", "EXECUTADA")
    .is("voided_at", null)
    .limit(1);
  return ((data ?? []) as Row[]).length > 0;
}

/** Cancelamentos que NÃO representam decisão da régua (desfazer de resultado). */
const NEUTRALIZED_CANCEL_REASONS = new Set(["undo_call_outcome"]);

export async function loadCadenceV2State(record: CadenceRecord): Promise<V2DecisionInput | null> {
  const flow = v2FlowOf(record.flow);
  if (!flow) return null;

  const [{ data: queueRows }, { data: cycleRow }, stageKey, material, e0Executed] =
    await Promise.all([
      supabaseAdmin
        .from("relationship_queue")
        .select("step,action_order,action_kind,status,due_at,executed_at,result,cancel_reason")
        .eq("scope", record.scope)
        .eq("lead_id", record.leadId)
        .order("due_at", { ascending: true }),
      supabaseAdmin
        .from("relationship_cadences")
        .select("awaiting_handoff,started_at,created_at")
        .eq("scope", record.scope)
        .eq("lead_id", record.leadId)
        .eq("active", true)
        .order("instance_seq", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadStageKey(record.leadId),
      loadMaterialState(record.leadId),
      loadE0Executed(record.leadId),
    ]);


  const actions: V2QueueAction[] = ((queueRows ?? []) as Row[])
    // Linha neutralizada por "desfazer resultado" não é decisão da régua.
    .filter(
      (row) =>
        !(row.status === "CANCELLED" && NEUTRALIZED_CANCEL_REASONS.has(row.cancel_reason ?? "")),
    )
    .map((row) => ({
      step: row.step,
      actionOrder: row.action_order ?? 1,
      actionKind: row.action_kind === "call" ? "call" : "message",
      status: row.status,
      dueAt: row.due_at,
      executedAt: row.executed_at ?? null,
      result: row.result ?? null,
    }));

  const originIso =
    record.startedAt ?? (cycleRow as Row | null)?.started_at ?? (cycleRow as Row | null)?.created_at;

  return {
    nowIso: new Date().toISOString(),
    flow,
    originDate: localDateOf(originIso ?? new Date().toISOString()),
    actions,
    executedSteps: [
      ...(record.executedSteps ?? []).map(String),
      ...(e0Executed ? ["E0"] : []),
    ],

    cycle: {
      materialSent: material.materialSent,
      materialRequested: material.materialRequested,
      needsNewPresentation: false,
    },
    stageKey,
    awaitingHandoff: Boolean((cycleRow as Row | null)?.awaiting_handoff),
    closed: ["COMPLETED", "CLOSED", "INTERRUPTED"].includes(record.state),
    materialRequestedAt: material.materialRequestedAt,
  };
}
