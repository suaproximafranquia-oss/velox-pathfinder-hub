/**
 * CAMINHO V (V0/V1/V2/V3) — SERVER ONLY, Financeira /f.
 *
 * V0 NÃO é etapa: é uma decisão interna do motor, tomada UMA ÚNICA VEZ,
 * imediatamente antes de existir a primeira etapa pós-E0. Se a
 * visualização do material estiver confirmada, o ciclo segue pelo
 * CONTEXTO V das etapas E1/E2/E3; caso contrário, segue no contexto
 * normal. Depois de gravada, a decisão nunca é reconsultada.
 *
 * Nada aqui cria etapa, fila, cadência, tracking ou pontuação nova:
 *  • a evidência vem do tracking existente do Portal
 *    (`portal_journey_events`, alimentado por `trackPortalProgress`);
 *  • o marco e a decisão são gravados como FATO estruturado em
 *    `relationship_events`, com chave idempotente.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { canonicalModule } from "@/lib/portal-module-keys";

type Row = Record<string, any>;

/** Tipos de evento do caminho V — vocabulário fechado e auditável. */
export const V_PATH_OPENED = "V_PATH_OPENED";
export const V_PATH_SKIPPED = "V_PATH_SKIPPED";
export const MATERIAL_VIEWED = "MATERIAL_VIEWED";

/**
 * Intervalo máximo entre dois sinais reais que ainda conta como leitura
 * contínua — o mesmo teto já usado pelo engajamento do Portal.
 */
export const MAX_ACTIVE_GAP_MS = 5 * 60 * 1000;

/**
 * VISUALIZAÇÃO CONFIRMADA: tempo efetivo mínimo dentro do módulo do
 * material, contado SOMENTE depois da disponibilização formal
 * (CONTENT_SENT). Abrir o Portal não confirma visualização.
 */
export const CONFIRMED_VIEW_MS = 3 * 60 * 1000;

/** Módulos que representam o material institucional disponibilizado. */
const MATERIAL_MODULES = new Set(["material", "manual"]);

/**
 * Tempo efetivo do investidor no material APÓS a disponibilização
 * formal. Soma os intervalos entre sinais reais consecutivos, cada
 * intervalo limitado a `MAX_ACTIVE_GAP_MS`. Nenhum tempo é estimado.
 */
export async function materialActiveMsAfter(
  investorId: string,
  sinceIso: string,
): Promise<number> {
  const { data } = await supabaseAdmin
    .from("portal_journey_events")
    .select("module,created_at")
    .eq("investor_id", investorId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(2000);

  const stamps = ((data ?? []) as Row[])
    .filter((row) => MATERIAL_MODULES.has(canonicalModule(row.module) ?? ""))
    .map((row) => Date.parse(String(row.created_at)))
    .filter((ms) => Number.isFinite(ms));

  let total = 0;
  for (let i = 1; i < stamps.length; i += 1) {
    const delta = stamps[i]! - stamps[i - 1]!;
    if (delta > 0 && delta <= MAX_ACTIVE_GAP_MS) total += delta;
  }
  return total;
}

/** Já existe decisão gravada do caminho V para este lead/ciclo? */
async function readDecision(leadId: string): Promise<boolean | null> {
  const { data } = await supabaseAdmin
    .from("relationship_events")
    .select("type")
    .eq("scope", "production")
    .eq("lead_id", leadId)
    .in("type", [V_PATH_OPENED, V_PATH_SKIPPED])
    .order("occurred_at", { ascending: false })
    .limit(1);
  const row = ((data ?? []) as Row[])[0];
  if (!row) return null;
  return row.type === V_PATH_OPENED;
}

async function insertEvent(params: {
  leadId: string;
  type: string;
  eventKey: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("relationship_events").insert({
    scope: "production",
    run_id: null,
    lead_id: params.leadId,
    event_key: params.eventKey,
    type: params.type,
    occurred_at: new Date().toISOString(),
    data: params.data as any,
  } as any);
  // Chave repetida = fato já registrado; nada é reescrito.
  if (error && error.code !== "23505") throw new Error(error.message);
}

/**
 * DECISÃO ÚNICA DO V0.
 *
 * Só acontece na janela correta: E0 já executada e a primeira etapa
 * pós-E0 ainda não criada. Fora dessa janela devolve a decisão já
 * gravada (ou "sem caminho V") sem gravar nada.
 */
export async function ensureVisualPathDecision(params: {
  leadId: string;
  /** A primeira etapa pós-E0 já existe (E1 criada/executada)? */
  firstStepStarted: boolean;
  /** A E0 já foi executada? */
  e0Executed: boolean;
  /** Instante da disponibilização formal do material (CONTENT_SENT). */
  materialSentAt: string | null;
}): Promise<boolean> {
  const existing = await readDecision(params.leadId);
  if (existing !== null) return existing;
  if (params.firstStepStarted || !params.e0Executed) return false;

  let visual = false;
  let activeMs = 0;
  if (params.materialSentAt) {
    activeMs = await materialActiveMsAfter(params.leadId, params.materialSentAt);
    visual = activeMs >= CONFIRMED_VIEW_MS;
  }

  if (visual) {
    // Marco estruturado da visualização confirmada — auditável e único.
    await insertEvent({
      leadId: params.leadId,
      type: MATERIAL_VIEWED,
      eventKey: `material_viewed_${params.leadId}`,
      data: { activeMs, since: params.materialSentAt, thresholdMs: CONFIRMED_VIEW_MS },
    });
  }

  await insertEvent({
    leadId: params.leadId,
    type: visual ? V_PATH_OPENED : V_PATH_SKIPPED,
    eventKey: `v_path_${params.leadId}`,
    data: {
      activeMs,
      materialSentAt: params.materialSentAt,
      thresholdMs: CONFIRMED_VIEW_MS,
    },
  });

  // Corrida entre dois ticks: vale sempre a decisão gravada primeiro.
  const persisted = await readDecision(params.leadId);
  return persisted ?? visual;
}

/**
 * PASSAGEM HISTÓRICA POR E4 — histórico REAL do lead, não da instância
 * corrente. Uma nova instância R jamais apaga o fato de a E4 ter
 * acontecido.
 */
export async function reachedE4Historically(
  leadId: string,
  scope: string,
): Promise<boolean> {
  const [{ data: queueRows }, { data: eventRows }] = await Promise.all([
    supabaseAdmin
      .from("relationship_queue")
      .select("id")
      .eq("scope", scope)
      .eq("lead_id", leadId)
      .eq("step", "E4")
      .eq("status", "EXECUTED")
      .limit(1),
    supabaseAdmin
      .from("relationship_events")
      .select("id")
      .eq("scope", scope)
      .eq("lead_id", leadId)
      .eq("step", "E4")
      .limit(1),
  ]);
  return ((queueRows ?? []) as Row[]).length > 0 || ((eventRows ?? []) as Row[]).length > 0;
}
