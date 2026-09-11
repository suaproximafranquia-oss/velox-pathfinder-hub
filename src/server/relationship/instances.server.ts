/**
 * INSTÂNCIAS DE CADÊNCIA — SERVER ONLY.
 *
 * Um mesmo lead pode percorrer a jornada mais de uma vez. Cada passagem
 * é uma INSTÂNCIA independente: tem começo, etapas próprias e fim. A
 * instância anterior nunca é apagada nem reescrita — ela é encerrada e
 * fica no histórico, exatamente como aconteceu.
 *
 * Regras:
 *  - No máximo UMA instância ativa por lead (garantido por índice único).
 *  - Abrir nova instância encerra a ativa com um motivo explícito.
 *  - OPORTUNIDADE é terminal: nenhuma instância nova nasce depois dela.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isTerminalStage } from "@/lib/relationship/closing";
import type { EngineScope } from "@/lib/relationship/types";

export type InstanceRow = {
  id: string;
  leadId: string;
  instanceSeq: number;
  active: boolean;
  state: string;
  flow: string;
  openedReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  closeReason: string | null;
};

function toInstance(row: Record<string, any>): InstanceRow {
  return {
    id: row["id"],
    leadId: row["lead_id"],
    instanceSeq: row["instance_seq"] ?? 1,
    active: Boolean(row["active"]),
    state: row["state"],
    flow: row["flow"],
    openedReason: row["opened_reason"] ?? null,
    startedAt: row["started_at"] ?? null,
    endedAt: row["ended_at"] ?? null,
    closeReason: row["close_reason"] ?? null,
  };
}

/** Todas as passagens do lead pela jornada, da mais recente à primeira. */
export async function listInstances(
  leadId: string,
  scope: EngineScope = "production",
): Promise<InstanceRow[]> {
  const { data } = await supabaseAdmin
    .from("relationship_cadences")
    .select("*")
    .eq("scope", scope)
    .eq("lead_id", leadId)
    .order("instance_seq", { ascending: false });
  return (data ?? []).map(toInstance);
}

export async function activeInstance(
  leadId: string,
  scope: EngineScope = "production",
): Promise<InstanceRow | null> {
  const { data } = await supabaseAdmin
    .from("relationship_cadences")
    .select("*")
    .eq("scope", scope)
    .eq("lead_id", leadId)
    .eq("active", true)
    .order("instance_seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toInstance(data as Record<string, any>) : null;
}

/** Encerra a instância ativa sem abrir outra. O histórico permanece. */
export async function closeActiveInstance(
  leadId: string,
  reason: string,
  scope: EngineScope = "production",
): Promise<InstanceRow | null> {
  const current = await activeInstance(leadId, scope);
  if (!current) return null;
  const at = new Date().toISOString();
  await supabaseAdmin
    .from("relationship_cadences")
    .update({
      active: false,
      ended_at: at,
      closed_at: current.endedAt ?? at,
      close_reason: reason,
      updated_at: at,
    } as any)
    .eq("id", current.id);
  return { ...current, active: false, endedAt: at, closeReason: reason };
}

export type OpenInstanceResult =
  | { opened: false; reason: string }
  | { opened: true; instanceSeq: number; id: string; closedPrevious: number | null };

/**
 * Abre uma nova instância. Se já existir uma ativa, ela é encerrada
 * primeiro com o motivo informado (por exemplo `encerrada_por_nova`).
 */
export async function openInstance(params: {
  leadId: string;
  openedReason: string;
  closeReason?: string;
  flow?: string;
  startedBy?: string | null;
  /** Etapa atual do lead no quadro — decide a trava terminal. */
  stageKey?: string | null;
  scope?: EngineScope;
}): Promise<OpenInstanceResult> {
  const scope = params.scope ?? "production";
  const current = await activeInstance(params.leadId, scope);

  // OPORTUNIDADE é o limite absoluto: nenhuma instância nova nasce
  // depois dela. A etapa vem do quadro, não do estado interno.
  const { data: leadRow } = await supabaseAdmin
    .from("portal_leads")
    .select("commercial_state")
    .eq("id", params.leadId)
    .maybeSingle();
  const stage = params.stageKey ?? (leadRow as Record<string, any> | null)?.["commercial_state"];
  if (isTerminalStage(stage)) {
    return {
      opened: false,
      reason:
        "Lead em OPORTUNIDADE: a jornada automática está encerrada e não é reaberta pelo sistema.",
    };
  }

  if (current) {
    await closeActiveInstance(params.leadId, params.closeReason ?? "encerrada_por_nova", scope);
  }

  const at = new Date().toISOString();
  const seq = (current?.instanceSeq ?? 0) + 1;
  const { data, error } = await supabaseAdmin
    .from("relationship_cadences")
    .insert({
      scope,
      run_id: null,
      lead_id: params.leadId,
      instance_seq: seq,
      active: true,
      opened_reason: params.openedReason,
      state: "CADENCE_NOT_STARTED",
      flow: params.flow ?? "sem_resposta",
      executed_steps: [],
      started_at: at,
      started_by: params.startedBy ?? null,
      content_history: [],
      opening_template_history: [],
      updated_at: at,
    } as any)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    opened: true,
    instanceSeq: seq,
    id: (data as Record<string, any>)["id"],
    closedPrevious: current?.instanceSeq ?? null,
  };
}
