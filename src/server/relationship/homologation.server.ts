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
  SCENARIOS,
  buildSimulatedLeads,
  runSimulation,
  type ScenarioKey,
  type SimulationOutput,
} from "@/lib/relationship/simulation";

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
  /** COMANDO 3C §3/§4 — identificação e cronometragem da execução real. */
  status: string;
  timezone: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  contents: number;
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

/**
 * Próximo identificador sequencial de rodada (COMANDO 3C §3).
 *
 * A numeração vem do MAIOR número já registrado no domínio de
 * homologação — nunca da contagem de linhas nem da tela. Apagar uma
 * rodada antiga não faz a sequência retroceder para 001.
 */
export function nextRunNumber(existing: string[]): number {
  let max = 0;
  for (const id of existing) {
    const match = /(\d+)\s*$/.exec(String(id ?? ""));
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max + 1;
}

async function nextRunId(): Promise<string> {
  const { data } = await supabaseAdmin.from("relationship_sim_runs").select("run_id");
  const numbers = (data ?? []).map((r) => String(r.run_id));
  return `RUN-${String(nextRunNumber(numbers)).padStart(3, "0")}`;
}

/** Fuso oficial de referência das rodadas. */
export const RUN_TIMEZONE = "America/Sao_Paulo";

export async function executeHomologationRun(input: {
  executiveName: string;
  portalLink: string;
  totalLeads: number;
  userId: string | null;
  userName: string;
}): Promise<RunSummary> {
  const runId = await nextRunId();
  const startedAt = new Date();
  const leads = buildSimulatedLeads(input.totalLeads);
  const output = await runSimulation({
    runId,
    leads,
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
      return {
        direction: m.direction,
        // COMANDO 3D §7 — autoria explícita: define o lado da conversa.
        author:
          m.direction === "inbound"
            ? ("INVESTOR" as const)
            : m.direction === "system"
              ? ("SYSTEM" as const)
              : ("EXECUTIVE" as const),
        authorName:
          m.direction === "inbound"
            ? `Investidor ${r.lead.leadId}`
            : m.direction === "system"
              ? "Sistema"
              : `Velox / ${input.executiveName}`,
        step: m.step,
        body: m.body,
        at: m.at,
        contentId: m.contentId,
        contentName: m.contentName,
        contentKind: null,
        contentUrl: m.button?.url ?? null,
        contentGroup: null,
        // Representação visual do botão do template (sem Meta).
        button: m.button ?? null,
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
    /**
     * COMANDO 3C §3 e §5 — execução REAL da rodada, separada das datas
     * simuladas dos cenários (que continuam nas conversas).
     */
    execution: {
      runId,
      timezone: RUN_TIMEZONE,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      seed: output.seed,
      totalLeads: output.leadResults.length,
      messages: output.messages.length,
      contents: Object.keys(output.contentUsage).length,
      contentsSent: totals.contents,
    },
    /**
     * COMANDO 3C §12 — qual conteúdo foi selecionado por lead e etapa.
     * É esta tabela que permite verificar a alternância real de E1, E3,
     * R1 e R2 entre rodadas.
     */
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
    status: failed === 0 ? "APROVADA" : "COM_DIVERGENCIAS",
    timezone: RUN_TIMEZONE,
    startedAt: report.execution.startedAt,
    finishedAt: report.execution.finishedAt,
    durationMs: report.execution.durationMs,
    contents: report.execution.contentsSent,
  };
}

export async function listHomologationRuns(): Promise<RunSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("relationship_sim_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const execution = ((row.report as Record<string, unknown> | null)?.["execution"] ?? null) as {
      startedAt?: string;
      finishedAt?: string;
      durationMs?: number;
      timezone?: string;
      contentsSent?: number;
    } | null;
    const usage = (row.content_usage as unknown as Record<string, number>) ?? {};
    return {
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
      contentUsage: usage,
      contentGaps: [],
      status: String(row.status ?? ""),
      timezone: execution?.timezone ?? RUN_TIMEZONE,
      startedAt: execution?.startedAt ?? null,
      finishedAt: execution?.finishedAt ?? String(row.created_at),
      durationMs: typeof execution?.durationMs === "number" ? execution.durationMs : null,
      contents:
        typeof execution?.contentsSent === "number"
          ? execution.contentsSent
          : Object.values(usage).reduce((a, b) => a + Number(b || 0), 0),
    };
  });
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
