/**
 * HOMOLOGAÇÃO DO MOTOR DE RELACIONAMENTO — SERVER ONLY (COMANDO 3A).
 *
 * Aqui vive a execução das rodadas do simulador bilateral e a gestão da
 * biblioteca de conteúdos de valor. Tudo acontece exclusivamente no
 * escopo "homologation", com leads fictícios TEST-XXXX: nenhuma linha
 * deste arquivo toca produção, Portal dos Leads ou GreenSales, e nenhum
 * envio real é possível — o despachante da simulação é de memória.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CONTENT_GROUPS,
  contentLibraryGaps,
  type ValueContent,
} from "@/lib/relationship/content";
import {
  SCENARIOS,
  buildSimulatedLeads,
  runSimulation,
  type ScenarioKey,
  type SimulationOutput,
} from "@/lib/relationship/simulation";

/**
 * A Biblioteca de Conteúdos é PERMANENTE (COMANDO 3B §5 e §9): vive em
 * escopo próprio, é usada pela homologação e continuará servindo a
 * operação real. Rodadas de teste nunca a apagam.
 */
const LIBRARY_SCOPE = "library";

/* ------------------------------------------------------------------ */
/* Biblioteca de conteúdos de valor (permanente)                       */
/* ------------------------------------------------------------------ */

export async function listValueContents(): Promise<ValueContent[]> {
  const { data, error } = await supabaseAdmin
    .from("relationship_contents")
    .select("id,content_group,name,description,kind,url,mime_type,active,usage_count,last_used_at,created_at,updated_at")
    .eq("scope", LIBRARY_SCOPE)
    .order("content_group", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    group: String(row.content_group),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    kind: row.kind as ValueContent["kind"],
    mimeType: (row.mime_type as string | null) ?? null,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
    url: String(row.url),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    usageCount: Number(row.usage_count ?? 0),
  }));
}

export type ContentInput = {
  id?: string | null;
  group: string;
  name: string;
  description?: string | null;
  kind: ValueContent["kind"];
  url: string;
  mimeType?: string | null;
  active: boolean;
};

export async function saveValueContent(input: ContentInput): Promise<ValueContent[]> {
  if (!CONTENT_GROUPS.includes(input.group as never)) {
    throw new Error(`Grupo de conteúdo desconhecido: ${input.group}.`);
  }
  const payload = {
    scope: LIBRARY_SCOPE,
    content_group: input.group,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    kind: input.kind,
    mime_type: input.mimeType ?? null,
    url: input.url.trim(),
    active: input.active,
    updated_at: new Date().toISOString(),
  };
  if (!payload.name || !payload.url) throw new Error("Nome e link do conteúdo são obrigatórios.");
  const query = input.id
    ? supabaseAdmin.from("relationship_contents").update(payload).eq("id", input.id).eq("scope", LIBRARY_SCOPE)
    : supabaseAdmin.from("relationship_contents").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return listValueContents();
}

export async function deleteValueContent(id: string): Promise<ValueContent[]> {
  const { error } = await supabaseAdmin
    .from("relationship_contents")
    .delete()
    .eq("id", id)
    .eq("scope", LIBRARY_SCOPE);
  if (error) throw new Error(error.message);
  return listValueContents();
}

/* ------------------------------------------------------------------ */
/* Rodadas de homologação                                              */
/* ------------------------------------------------------------------ */

export type ScenarioSummary = {
  scenario: ScenarioKey;
  label: string;
  total: number;
  passed: number;
  failed: number;
  expectedSteps: string[];
};

export type RunSummary = {
  runId: string;
  label: string;
  createdAt: string;
  createdByName: string;
  totalLeads: number;
  passed: number;
  failed: number;
  messages: number;
  outsideHours: number;
  scenarios: ScenarioSummary[];
  contentUsage: Record<string, number>;
  contentGaps: string[];
};

function summarize(output: SimulationOutput): {
  scenarios: ScenarioSummary[];
  passed: number;
  failed: number;
} {
  const scenarios: ScenarioSummary[] = (Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
    const leads = output.leadResults.filter((r) => r.lead.scenario === key);
    return {
      scenario: key,
      label: SCENARIOS[key].name,
      total: leads.length,
      passed: leads.filter((r) => r.result === "PASS").length,
      failed: leads.filter((r) => r.result === "FAIL").length,
      expectedSteps: SCENARIOS[key].expectedSteps,
    };
  });
  return {
    scenarios,
    passed: output.leadResults.filter((r) => r.result === "PASS").length,
    failed: output.leadResults.filter((r) => r.result === "FAIL").length,
  };
}

/** Próximo identificador sequencial de rodada (#001, #002, ...). */
async function nextRunId(): Promise<string> {
  const { count } = await supabaseAdmin
    .from("relationship_sim_runs")
    .select("id", { count: "exact", head: true });
  return `RUN-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

export async function executeHomologationRun(input: {
  executiveName: string;
  portalLink: string;
  totalLeads: number;
  userId: string | null;
  userName: string;
}): Promise<RunSummary> {
  const library = await listValueContents();
  const gaps = contentLibraryGaps(library);
  if (gaps.length > 0) {
    throw new Error(
      `A biblioteca de conteúdos ainda está incompleta:\n- ${gaps.join("\n- ")}`,
    );
  }
  const runId = await nextRunId();
  const leads = buildSimulatedLeads(input.totalLeads);
  const output = await runSimulation({
    runId,
    leads,
    library,
    executiveName: input.executiveName,
    portalLink: input.portalLink,
  });
  const { scenarios, passed, failed } = summarize(output);

  /**
   * COMANDO 3B §17 e §19 — cada conversa fictícia é persistida para que
   * possa ser INSPECIONADA VISUALMENTE no CRM de homologação: mensagem,
   * anexo, tipo do anexo, visualização, resposta, horário virtual e
   * decisão do motor (inclusive os NÃO ENVIOS e seus motivos, §20).
   */
  const byId = new Map(library.map((c) => [c.id, c]));
  const conversations = output.leadResults.map((r) => ({
    leadId: r.lead.leadId,
    displayName: r.lead.displayName,
    scenario: r.lead.scenario,
    scenarioLabel: SCENARIOS[r.lead.scenario].name,
    entryAt: r.lead.entryAt,
    entryLabel: r.lead.entryLabel,
    result: r.result,
    divergence: r.divergence,
    finalState: r.finalState,
    finalFlow: r.finalFlow,
    reads: r.reads,
    responses: r.responses,
    scheduled: r.scheduled,
    nameConfirmed: r.nameConfirmed,
    expectedSteps: r.expectedSteps,
    executedSteps: r.executedSteps,
    contentsUsed: r.contentsUsed,
    messages: r.messages.map((m) => {
      const content = m.contentId ? byId.get(m.contentId) ?? null : null;
      return {
        direction: m.direction,
        step: m.step,
        body: m.body,
        at: m.at,
        contentId: m.contentId,
        contentName: m.contentName,
        contentKind: content?.kind ?? null,
        contentUrl: content?.url ?? null,
        contentGroup: content?.group ?? null,
      };
    }),
    journey: r.journey,
    decisions: r.decisions.map((d) => ({
      at: d.at,
      step: d.step,
      flow: d.flow,
      stateBefore: d.stateBefore,
      stateAfter: d.stateAfter,
      outcome: d.outcome,
      reason: d.reason,
      contentId: d.contentId ?? null,
      error: d.error ?? null,
    })),
  }));

  const blocked = output.decisions.filter((d) => d.outcome === "blocked").length;
  const totals = {
    leads: output.leadResults.length,
    messages: output.messages.length,
    outbound: output.messages.filter((m) => m.direction === "outbound").length,
    inbound: output.messages.filter((m) => m.direction === "inbound").length,
    contents: output.messages.filter((m) => m.contentId).length,
    reads: output.leadResults.reduce((n, r) => n + r.reads, 0),
    responses: output.leadResults.reduce((n, r) => n + r.responses, 0),
    scheduled: output.leadResults.filter((r) => r.scheduled).length,
    blocked,
    divergences: failed,
    errors: output.leadResults.reduce((n, r) => n + r.errors.length, 0),
    /** COMANDO 3B §25 — obrigatoriamente ZERO. O simulador não possui canal. */
    metaCalls: 0,
  };

  // O relatório completo fica guardado para auditoria posterior; só as
  // jornadas divergentes vão em detalhe para não inflar o registro.
  const report = {
    totals,
    conversations,
    generatedAt: new Date().toISOString(),
    executiveName: input.executiveName,
    portalLink: input.portalLink,
    scenarios,
    outsideBusinessHours: output.outsideBusinessHours.slice(0, 50),
    divergences: output.leadResults
      .filter((r) => r.result === "FAIL")
      .slice(0, 100)
      .map((r) => ({
        leadId: r.lead.leadId,
        scenario: r.lead.scenario,
        divergence: r.divergence,
        executedSteps: r.executedSteps,
        expectedSteps: r.expectedSteps,
        finalState: r.finalState,
      })),
    sample: output.leadResults.slice(0, 5).map((r) => ({
      leadId: r.lead.leadId,
      scenario: r.lead.scenario,
      name: r.lead.rawName,
      nameConfirmed: r.nameConfirmed,
      executedSteps: r.executedSteps,
      finalState: r.finalState,
      journey: r.journey,
      messages: r.messages,
    })),
  };

  const { error } = await supabaseAdmin.from("relationship_sim_runs").insert({
    run_id: runId,
    label: `Rodada ${runId} — ${input.totalLeads} leads fictícios`,
    status: failed === 0 ? "APROVADA" : "COM_DIVERGENCIAS",
    total_leads: output.leadResults.length,
    passed,
    failed,
    messages_count: output.messages.length,
    outside_hours: output.outsideBusinessHours.length,
    scenario_summary: scenarios,
    content_usage: output.contentUsage,
    report,
    created_by: input.userId,
    created_by_name: input.userName,
  });
  if (error) throw new Error(error.message);

  return {
    runId,
    label: `Rodada ${runId} — ${input.totalLeads} leads fictícios`,
    createdAt: new Date().toISOString(),
    createdByName: input.userName,
    totalLeads: output.leadResults.length,
    passed,
    failed,
    messages: output.messages.length,
    outsideHours: output.outsideBusinessHours.length,
    scenarios,
    contentUsage: output.contentUsage,
    contentGaps: [],
  };
}

export async function listHomologationRuns(): Promise<RunSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("relationship_sim_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    runId: String(row.run_id),
    label: String(row.label),
    createdAt: String(row.created_at),
    createdByName: String(row.created_by_name ?? ""),
    totalLeads: Number(row.total_leads ?? 0),
    passed: Number(row.passed ?? 0),
    failed: Number(row.failed ?? 0),
    messages: Number(row.messages_count ?? 0),
    outsideHours: Number(row.outside_hours ?? 0),
    scenarios: (row.scenario_summary as unknown as ScenarioSummary[]) ?? [],
    contentUsage: (row.content_usage as unknown as Record<string, number>) ?? {},
    contentGaps: [],
  }));
}

export async function readHomologationRun(runId: string) {
  const { data, error } = await supabaseAdmin
    .from("relationship_sim_runs")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}
