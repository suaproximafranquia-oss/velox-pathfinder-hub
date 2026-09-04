/**
 * LABORATÓRIO DE CADÊNCIA EM TEMPO REAL — SERVER ONLY.
 *
 * Cria LOTES de leads fictícios que entram pelo caminho real do sistema
 * (`intakeLead`), são conduzidos pelo motor real, com relógio real e
 * cron real. Nenhuma aceleração de tempo, nenhuma trilha paralela.
 *
 * TRAVAS:
 *  • marcação técnica explícita (`is_test` + `test_batch_id`);
 *  • nenhum lead real pode ser marcado, movido ou apagado por aqui;
 *  • saída externa impossível: o despachante força simulação para todo
 *    lead marcado, mesmo com credencial real presente;
 *  • limpeza age exclusivamente sobre registros do lote informado.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildBatchId,
  buildIntakePayload,
  buildSyntheticLead,
  type TestScenarioKey,
} from "@/lib/testing/test-lab";
import { loadSettings } from "@/server/crm/automation.server";
import { intakeLead } from "@/server/crm/lead-intake.server";
import {
  DEFAULT_PIPELINE_EXTERNAL_ID,
  ENTRY_STAGE_KEY,
  loadPipeline,
} from "@/server/crm/pipeline-service.server";
import { logEngineAction, productionEngine } from "@/server/relationship/engine.server";

export type CreateBatchInput = {
  scenarios: TestScenarioKey[];
  perScenario: number;
  notes?: string | null;
  createdBy?: string | null;
  createdByName?: string;
  /**
   * Executivo RESPONSÁVEL pelos leads do lote. Opcional: ausente mantém
   * o comportamento anterior (card sem responsável → E0 manual). Quando
   * informado, o lead percorre o MESMO caminho de um lead real com dono
   * — a identidade é convertida em `connectionUserId` e o modo do E0
   * continua sendo decidido pelas permissões do próprio executivo.
   */
  responsibleExecutiveId?: string | null;
};

export type BatchLead = {
  id: string;
  cardId: string | null;
  name: string;
  scenario: string;
  e0: string;
  reason?: string;
};

export type CreateBatchResult = {
  ok: boolean;
  batchId: string;
  leads: BatchLead[];
  errors: string[];
};

export async function createTestBatch(input: CreateBatchInput): Promise<CreateBatchResult> {
  const scenarios = input.scenarios.filter(Boolean);
  const perScenario = Math.max(1, Math.min(10, Math.trunc(input.perScenario || 1)));
  if (scenarios.length === 0) {
    return { ok: false, batchId: "", leads: [], errors: ["Nenhum cenário selecionado."] };
  }

  const { data: existing } = await supabaseAdmin.from("test_batches").select("id");
  const batchId = buildBatchId((existing ?? []).map((b) => b.id));

  const pipeline = await loadPipeline(DEFAULT_PIPELINE_EXTERNAL_ID);
  if (!pipeline) {
    return { ok: false, batchId, leads: [], errors: ["Funil operacional não encontrado."] };
  }
  const entry = pipeline.stages.find((s) => s.key === ENTRY_STAGE_KEY);
  if (!entry) {
    return { ok: false, batchId, leads: [], errors: ["Coluna de entrada (NOVOS) não encontrada."] };
  }

  const settings = await loadSettings();
  /**
   * Responsável do lote → usuário real do executivo. Nada é inventado:
   * sem perfil correspondente o lote é recusado, em vez de nascer com
   * dono errado.
   */
  let connectionUserId: string | null = null;
  if (input.responsibleExecutiveId) {
    const { data: profile } = await supabaseAdmin
      .from("executive_profiles")
      .select("user_id")
      .eq("executive_id", input.responsibleExecutiveId)
      .maybeSingle();
    const userId = (profile as { user_id?: string | null } | null)?.user_id ?? null;
    if (!userId) {
      return {
        ok: false,
        batchId,
        leads: [],
        errors: [
          `Executivo ${input.responsibleExecutiveId} não possui usuário vinculado — lote não criado.`,
        ],
      };
    }
    connectionUserId = userId;
  }
  const nowIso = new Date().toISOString();
  const leads: BatchLead[] = [];
  const errors: string[] = [];

  await supabaseAdmin.from("test_batches").insert({
    id: batchId,
    label: `Lote ${batchId}`,
    scenarios: scenarios as never,
    notes: input.notes ?? null,
    created_by: input.createdBy ?? null,
    created_by_name: input.createdByName ?? "sistema",
  } as never);

  let index = 0;
  for (const scenario of scenarios) {
    for (let i = 0; i < perScenario; i += 1) {
      const lead = buildSyntheticLead(batchId, scenario, index);
      index += 1;
      const payload = buildIntakePayload(lead, entry.externalTag, nowIso);
      try {
        const outcome = await intakeLead(payload, {
          pipeline,
          settings,
          test: { batchId },
        });
        leads.push({
          id: lead.externalId,
          cardId: outcome.cardId,
          name: lead.name,
          scenario,
          e0: outcome.e0,
          reason: outcome.e0Reason ?? outcome.error,
        });
        if (outcome.failed) errors.push(`${lead.externalId}: ${outcome.error}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha desconhecida.";
        errors.push(`${lead.externalId}: ${message}`);
      }
    }
  }

  await supabaseAdmin
    .from("test_batches")
    .update({ lead_count: leads.length } as never)
    .eq("id", batchId);
  await logEngineAction("lote_teste_criado", {
    batchId,
    cenarios: scenarios,
    leads: leads.length,
    erros: errors.length,
  });

  return { ok: errors.length === 0, batchId, leads, errors };
}

export type BatchSummary = {
  id: string;
  label: string;
  status: string;
  scenarios: string[];
  notes: string | null;
  leadCount: number;
  createdAt: string;
  createdByName: string;
};

export async function listTestBatches(): Promise<BatchSummary[]> {
  const { data } = await supabaseAdmin
    .from("test_batches")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map((b: Record<string, unknown>) => ({
    id: String(b["id"]),
    label: String(b["label"]),
    status: String(b["status"]),
    scenarios: Array.isArray(b["scenarios"]) ? (b["scenarios"] as string[]) : [],
    notes: (b["notes"] as string) ?? null,
    leadCount: Number(b["lead_count"] ?? 0),
    createdAt: String(b["created_at"]),
    createdByName: String(b["created_by_name"] ?? "sistema"),
  }));
}

export type BatchLeadState = {
  externalId: string;
  cardId: string;
  name: string;
  scenario: string;
  stageKey: string | null;
  cadenceState: string | null;
  currentStep: string | null;
  messages: number;
  lastMessageAt: string | null;
  nextStep: string | null;
  nextDueAt: string | null;
};

/** Estado ao vivo dos leads de um lote — leitura, nunca escrita. */
export async function readBatchLeads(batchId: string): Promise<BatchLeadState[]> {
  const { data: mirrors } = await supabaseAdmin
    .from("crm_leads")
    .select("external_id,name,stage_key,raw_payload")
    .eq("is_test", true)
    .eq("test_batch_id", batchId);

  const rows: BatchLeadState[] = [];
  for (const mirror of mirrors ?? []) {
    const cardId = `gs_${mirror.external_id}`;
    const payload = (mirror.raw_payload ?? {}) as { metas?: { meta_key?: string; meta_value?: string }[] };
    const scenario =
      payload.metas?.find((m) => m.meta_key === "cenario_teste")?.meta_value ?? "—";

    const { data: cadence } = await supabaseAdmin
      .from("relationship_cadences")
      .select("state,current_step")
      .eq("scope", "production")
      .eq("lead_id", cardId)
      .maybeSingle();

    const { data: messages } = await supabaseAdmin
      .from("crm_messages")
      .select("at")
      .eq("investor_id", cardId)
      .order("at", { ascending: false });

    const { data: queue } = await supabaseAdmin
      .from("relationship_queue")
      .select("step,due_at")
      .eq("scope", "production")
      .eq("lead_id", cardId)
      .eq("status", "PENDING")
      .order("due_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    rows.push({
      externalId: mirror.external_id,
      cardId,
      name: mirror.name,
      scenario,
      stageKey: mirror.stage_key,
      cadenceState: cadence?.state ?? null,
      currentStep: cadence?.current_step ?? null,
      messages: messages?.length ?? 0,
      lastMessageAt: messages?.[0]?.at ?? null,
      nextStep: queue?.step ?? null,
      nextDueAt: queue?.due_at ?? null,
    });
  }
  return rows.sort((a, b) => a.externalId.localeCompare(b.externalId));
}

export type BatchAction = "responder" | "agendar" | "interromper" | "avancar_etapa";

/** Ação humana simulada sobre um lead DE TESTE (nunca sobre lead real). */
export async function applyBatchAction(input: {
  batchId: string;
  externalId: string;
  action: BatchAction;
}): Promise<{ ok: boolean; message: string }> {
  const { data: mirror } = await supabaseAdmin
    .from("crm_leads")
    .select("id,is_test,test_batch_id")
    .eq("external_id", input.externalId)
    .eq("external_source", "greensales")
    .maybeSingle();
  if (!mirror?.is_test || mirror.test_batch_id !== input.batchId) {
    return { ok: false, message: "Lead não pertence a este lote de teste — ação recusada." };
  }

  const cardId = `gs_${input.externalId}`;
  const at = new Date().toISOString();

  if (input.action === "avancar_etapa") {
    // Primeira ação humana: o lead sai de NOVOS e o gate da E1 abre.
    await supabaseAdmin
      .from("crm_leads")
      .update({ stage_key: "em_contato", stage_entered_at: at } as never)
      .eq("id", mirror.id);
    await supabaseAdmin.from("portal_leads").update({ viewed_at: at } as never).eq("id", cardId);
    const decision = await productionEngine().tick(cardId);
    return { ok: true, message: `Lead movido de NOVOS. Motor: ${decision.outcome} — ${decision.reason}` };
  }

  const engine = productionEngine();
  if (input.action === "responder") {
    await supabaseAdmin.from("crm_messages").insert({
      id: `msg_teste_in_${input.externalId}_${Date.now()}`,
      investor_id: cardId,
      direction: "recebida",
      body: "[TESTE] Resposta simulada do investidor.",
      author_id: "teste",
      author_name: "Investidor (teste)",
      at,
    } as never);
  }
  const type =
    input.action === "responder"
      ? "MESSAGE_RECEIVED"
      : input.action === "agendar"
        ? "SCHEDULE_CREATED"
        : "MANUAL_INTERRUPTION";
  const decision = await engine.handleEvent({
    id: `${cardId}:${type}:${at}`,
    scope: "production",
    leadId: cardId,
    type: type as never,
    at,
  });
  return { ok: true, message: `${type}: ${decision.outcome} — ${decision.reason}` };
}

/** Limpeza por lote: remove SOMENTE registros marcados do lote. */
export async function purgeTestBatch(batchId: string): Promise<{ ok: boolean; removed: number }> {
  const { data: mirrors } = await supabaseAdmin
    .from("crm_leads")
    .select("id,external_id")
    .eq("is_test", true)
    .eq("test_batch_id", batchId);
  const ids = (mirrors ?? []).map((m) => m.id);
  const cardIds = (mirrors ?? []).map((m) => `gs_${m.external_id}`);

  if (cardIds.length > 0) {
    await supabaseAdmin.from("relationship_queue").delete().in("lead_id", cardIds);
    await supabaseAdmin.from("relationship_events").delete().in("lead_id", cardIds);
    await supabaseAdmin.from("relationship_decisions").delete().in("lead_id", cardIds);
    await supabaseAdmin.from("relationship_cadences").delete().in("lead_id", cardIds);
    await supabaseAdmin.from("crm_messages").delete().in("investor_id", cardIds);
    await supabaseAdmin.from("crm_timeline").delete().in("investor_id", cardIds);
    await supabaseAdmin
      .from("portal_leads")
      .delete()
      .eq("is_test", true)
      .eq("test_batch_id", batchId);
  }
  if (ids.length > 0) {
    await supabaseAdmin.from("crm_lead_events").delete().in("lead_id", ids);
    await supabaseAdmin.from("crm_leads").delete().eq("is_test", true).eq("test_batch_id", batchId);
  }
  await supabaseAdmin
    .from("test_batches")
    .update({ status: "LIMPO", lead_count: 0 } as never)
    .eq("id", batchId);
  await logEngineAction("lote_teste_limpo", { batchId, removidos: ids.length });
  return { ok: true, removed: ids.length };
}
