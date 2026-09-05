/**
 * BLOCO 4 — RESOLVEDOR ÚNICO DE VERSÕES DE FLUXO — SERVER ONLY.
 *
 * Responsabilidade exclusiva deste arquivo:
 *   • ler a configuração de uma versão de fluxo (etapas, ordem, prazo);
 *   • dizer qual é a versão PUBLICADA de cada fluxo;
 *   • administrar rascunhos e publicar versões.
 *
 * Nenhum outro arquivo consulta `relationship_flow_versions` ou
 * `relationship_flow_steps` diretamente.
 *
 * REGRA ABSOLUTA: versão publicada é IMUTÁVEL. Alterar um fluxo
 * publicado significa criar uma NOVA versão (rascunho), editá-la e
 * publicá-la. Ciclos existentes continuam apontando para a versão
 * antiga e nunca são recalculados.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { compatibilityPlan, type FlowPlan } from "@/lib/relationship/flow-plan";
import { FLOW_SEQUENCE } from "@/lib/relationship/config";
import type { CadenceFlow, CadenceStep } from "@/lib/relationship/types";

export type FlowVersionStatus = "rascunho" | "publicada" | "arquivada";

export type FlowVersionRow = {
  id: string;
  flowKey: CadenceFlow;
  version: number;
  status: FlowVersionStatus;
  publishedAt: string | null;
  createdAt: string | null;
};

export type FlowVersionDetail = FlowVersionRow & {
  steps: Array<{
    id: string;
    stepKey: CadenceStep;
    position: number;
    businessDaysAfterReference: number;
    active: boolean;
  }>;
};

export const FLOW_KEYS: CadenceFlow[] = Object.keys(FLOW_SEQUENCE) as CadenceFlow[];

/** Cache curto: a configuração de uma versão publicada não muda. */
const planCache = new Map<string, { at: number; plan: FlowPlan }>();
const PLAN_TTL_MS = 60_000;

function isFlowKey(value: string): value is CadenceFlow {
  return (FLOW_KEYS as string[]).includes(value);
}

async function loadDetail(versionId: string): Promise<FlowVersionDetail | null> {
  const { data: version } = await supabaseAdmin
    .from("relationship_flow_versions")
    .select("id,flow_key,version,status,published_at,created_at")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return null;

  const { data: steps } = await supabaseAdmin
    .from("relationship_flow_steps")
    .select("id,step_key,position,business_days_after_reference,active")
    .eq("flow_version_id", versionId)
    .order("position", { ascending: true });

  return {
    id: version.id,
    flowKey: version.flow_key as CadenceFlow,
    version: version.version,
    status: version.status as FlowVersionStatus,
    publishedAt: version.published_at ?? null,
    createdAt: version.created_at ?? null,
    steps: (steps ?? []).map((row) => ({
      id: row.id,
      stepKey: row.step_key as CadenceStep,
      position: row.position,
      businessDaysAfterReference: row.business_days_after_reference ?? 0,
      active: Boolean(row.active),
    })),
  };
}

/**
 * FONTE OPERACIONAL DA SEQUÊNCIA de um ciclo versionado. Sem versão
 * (ciclo legado) o chamador usa o plano de compatibilidade do
 * `config.ts` — nada é inventado aqui.
 */
export async function getFlowPlan(flowVersionId: string): Promise<FlowPlan | null> {
  const cached = planCache.get(flowVersionId);
  if (cached && Date.now() - cached.at < PLAN_TTL_MS) return cached.plan;

  const detail = await loadDetail(flowVersionId);
  if (!detail) return null;

  const plan: FlowPlan = {
    flowKey: detail.flowKey,
    flowVersionId: detail.id,
    version: detail.version,
    steps: detail.steps.map((s) => ({
      step: s.stepKey,
      position: s.position,
      businessDaysAfterReference: s.businessDaysAfterReference,
      active: s.active,
    })),
  };
  planCache.set(flowVersionId, { at: Date.now(), plan });
  return plan;
}

/** Plano efetivo de um ciclo: versão congelada OU compatibilidade. */
export async function resolveCyclePlan(
  flow: CadenceFlow,
  flowVersionId: string | null | undefined,
): Promise<FlowPlan> {
  if (flowVersionId) {
    const plan = await getFlowPlan(flowVersionId).catch(() => null);
    if (plan && plan.flowKey === flow) return plan;
  }
  return compatibilityPlan(flow);
}

/** Versão publicada atual de um fluxo (null = nenhuma publicada). */
export async function getPublishedVersion(flow: CadenceFlow): Promise<FlowVersionRow | null> {
  const { data } = await supabaseAdmin
    .from("relationship_flow_versions")
    .select("id,flow_key,version,status,published_at,created_at")
    .eq("flow_key", flow)
    .eq("status", "publicada")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    flowKey: data.flow_key as CadenceFlow,
    version: data.version,
    status: data.status as FlowVersionStatus,
    publishedAt: data.published_at ?? null,
    createdAt: data.created_at ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Administração                                                       */
/* ------------------------------------------------------------------ */

export async function listFlowVersions(flow: CadenceFlow): Promise<FlowVersionRow[]> {
  const { data } = await supabaseAdmin
    .from("relationship_flow_versions")
    .select("id,flow_key,version,status,published_at,created_at")
    .eq("flow_key", flow)
    .order("version", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    flowKey: row.flow_key as CadenceFlow,
    version: row.version,
    status: row.status as FlowVersionStatus,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at ?? null,
  }));
}

export async function getFlowVersionDetail(versionId: string) {
  return loadDetail(versionId);
}

async function assertDraft(versionId: string): Promise<FlowVersionDetail> {
  const detail = await loadDetail(versionId);
  if (!detail) throw new Error("Versão de fluxo não encontrada.");
  if (detail.status !== "rascunho") {
    throw new Error(
      "Versão publicada é imutável. Para alterar o fluxo, crie uma nova versão a partir dela.",
    );
  }
  return detail;
}

/**
 * NOVO RASCUNHO. Nasce copiando a configuração de uma versão de
 * referência (por padrão, a publicada; se não houver nenhuma, a
 * compatibilidade do `config.ts`). A versão de origem NÃO é alterada.
 */
export async function createFlowDraft(input: {
  flow: string;
  copyFromVersionId?: string | null;
}): Promise<FlowVersionDetail> {
  if (!isFlowKey(input.flow)) throw new Error(`Fluxo desconhecido: ${input.flow}`);
  const flow = input.flow;

  const existingDraft = await supabaseAdmin
    .from("relationship_flow_versions")
    .select("id")
    .eq("flow_key", flow)
    .eq("status", "rascunho")
    .maybeSingle();
  if (existingDraft.data?.id) {
    const detail = await loadDetail(existingDraft.data.id);
    if (detail) return detail;
  }

  const source = input.copyFromVersionId
    ? await loadDetail(input.copyFromVersionId)
    : await getPublishedVersion(flow).then((v) => (v ? loadDetail(v.id) : null));

  const { data: last } = await supabaseAdmin
    .from("relationship_flow_versions")
    .select("version")
    .eq("flow_key", flow)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (last?.version ?? 0) + 1;

  const { data: created, error } = await supabaseAdmin
    .from("relationship_flow_versions")
    .insert({ flow_key: flow, version: nextVersion, status: "rascunho" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const baseSteps =
    source?.steps.map((s) => ({
      step_key: s.stepKey,
      position: s.position,
      business_days_after_reference: s.businessDaysAfterReference,
      active: s.active,
    })) ??
    compatibilityPlan(flow).steps.map((s) => ({
      step_key: s.step,
      position: s.position,
      business_days_after_reference: s.businessDaysAfterReference,
      active: s.active,
    }));

  if (baseSteps.length > 0) {
    const { error: stepsError } = await supabaseAdmin
      .from("relationship_flow_steps")
      .insert(baseSteps.map((s) => ({ ...s, flow_version_id: created.id })));
    if (stepsError) throw new Error(stepsError.message);
  }

  const detail = await loadDetail(created.id);
  if (!detail) throw new Error("Rascunho criado, mas não pôde ser lido.");
  return detail;
}

/** Substitui a configuração COMPLETA de um rascunho (etapas/ordem/prazo). */
export async function saveFlowDraftSteps(input: {
  versionId: string;
  steps: Array<{ stepKey: string; businessDaysAfterReference: number; active: boolean }>;
}): Promise<FlowVersionDetail> {
  await assertDraft(input.versionId);

  const seen = new Set<string>();
  const rows = input.steps.map((s, index) => {
    const key = s.stepKey.trim().toUpperCase();
    if (!key) throw new Error("Etapa sem identificador.");
    if (seen.has(key)) throw new Error(`Etapa ${key} duplicada neste fluxo.`);
    seen.add(key);
    return {
      flow_version_id: input.versionId,
      step_key: key,
      position: index + 1,
      business_days_after_reference: Math.max(0, Math.trunc(s.businessDaysAfterReference || 0)),
      active: s.active !== false,
    };
  });

  await supabaseAdmin.from("relationship_flow_steps").delete().eq("flow_version_id", input.versionId);
  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from("relationship_flow_steps").insert(rows);
    if (error) throw new Error(error.message);
  }
  planCache.delete(input.versionId);

  const detail = await loadDetail(input.versionId);
  if (!detail) throw new Error("Rascunho não encontrado após a gravação.");
  return detail;
}

/**
 * PUBLICAÇÃO. A versão anterior é apenas ARQUIVADA — o conteúdo dela
 * (etapas, ordem, prazo) permanece intacto, e os ciclos que já apontam
 * para ela continuam funcionando exatamente como antes.
 */
export async function publishFlowVersion(input: {
  versionId: string;
  publishedBy?: string | null;
}): Promise<FlowVersionDetail> {
  const draft = await assertDraft(input.versionId);
  if (draft.steps.length === 0) {
    throw new Error("Um fluxo não pode ser publicado sem etapas.");
  }

  const current = await getPublishedVersion(draft.flowKey);
  if (current) {
    const { error } = await supabaseAdmin
      .from("relationship_flow_versions")
      .update({ status: "arquivada" })
      .eq("id", current.id)
      .eq("status", "publicada");
    if (error) throw new Error(error.message);
  }

  const { error } = await supabaseAdmin
    .from("relationship_flow_versions")
    .update({
      status: "publicada",
      published_at: new Date().toISOString(),
      published_by: input.publishedBy ?? null,
    })
    .eq("id", input.versionId)
    .eq("status", "rascunho");
  if (error) {
    // Publicação não concluída: a versão anterior volta a ser a vigente.
    if (current) {
      await supabaseAdmin
        .from("relationship_flow_versions")
        .update({ status: "publicada" })
        .eq("id", current.id);
    }
    throw new Error(error.message);
  }

  planCache.delete(input.versionId);
  const detail = await loadDetail(input.versionId);
  if (!detail) throw new Error("Versão publicada não pôde ser lida.");
  return detail;
}
