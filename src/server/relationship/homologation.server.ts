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

type Row = Record<string, never> & Record<string, string | number | boolean | null>;

const SCOPE = "homologation";

/* ------------------------------------------------------------------ */
/* Biblioteca de conteúdos de valor (permanente)                       */
/* ------------------------------------------------------------------ */

export async function listValueContents(): Promise<ValueContent[]> {
  const { data, error } = await supabaseAdmin
    .from("relationship_contents")
    .select("id,content_group,name,kind,url,active,usage_count,created_at,updated_at")
    .eq("scope", SCOPE)
    .order("content_group", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Row) => ({
    id: String(row["id"]),
    group: String(row["content_group"]),
    name: String(row["name"]),
    kind: row["kind"] as ValueContent["kind"],
    url: String(row["url"]),
    active: Boolean(row["active"]),
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
    usageCount: Number(row["usage_count"] ?? 0),
  }));
}

export type ContentInput = {
  id?: string | null;
  group: string;
  name: string;
  kind: ValueContent["kind"];
  url: string;
  active: boolean;
};

export async function saveValueContent(input: ContentInput): Promise<ValueContent[]> {
  if (!CONTENT_GROUPS.includes(input.group as never)) {
    throw new Error(`Grupo de conteúdo desconhecido: ${input.group}.`);
  }
  const payload = {
    scope: SCOPE,
    content_group: input.group,
    name: input.name.trim(),
    kind: input.kind,
    url: input.url.trim(),
    active: input.active,
    updated_at: new Date().toISOString(),
  };
  if (!payload.name || !payload.url) throw new Error("Nome e link do conteúdo são obrigatórios.");
  const query = input.id
    ? supabaseAdmin.from("relationship_contents").update(payload).eq("id", input.id).eq("scope", SCOPE)
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
    .eq("scope", SCOPE);
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
      label: SCENARIOS[key].label,
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

  // O relatório completo fica guardado para auditoria posterior; só as
  // jornadas divergentes vão em detalhe para não inflar o registro.
  const report = {
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
  return (data ?? []).map((row: Row) => ({
    runId: String(row["run_id"]),
    label: String(row["label"]),
    createdAt: String(row["created_at"]),
    createdByName: String(row["created_by_name"] ?? ""),
    totalLeads: Number(row["total_leads"] ?? 0),
    passed: Number(row["passed"] ?? 0),
    failed: Number(row["failed"] ?? 0),
    messages: Number(row["messages_count"] ?? 0),
    outsideHours: Number(row["outside_hours"] ?? 0),
    scenarios: (row["scenario_summary"] as unknown as ScenarioSummary[]) ?? [],
    contentUsage: (row["content_usage"] as unknown as Record<string, number>) ?? {},
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
