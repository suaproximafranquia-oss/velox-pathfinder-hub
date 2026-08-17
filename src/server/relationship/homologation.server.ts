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

/** Bucket privado dos materiais enviados por upload (COMANDO 3C §9). */
const LIBRARY_BUCKET = "biblioteca-conteudos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

/** Um arquivo físico, várias associações de grupo (COMANDO 3C §7). */
async function groupsByContent(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from("relationship_content_groups")
    .select("content_id,content_group")
    .in("content_id", ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const key = String(row.content_id);
    map.set(key, [...(map.get(key) ?? []), String(row.content_group)]);
  }
  return map;
}

export async function listValueContents(): Promise<ValueContent[]> {
  const { data, error } = await supabaseAdmin
    .from("relationship_contents")
    .select(
      "id,content_group,name,description,kind,url,body,mime_type,active,usage_count,last_used_at,created_at,updated_at",
    )
    .eq("scope", LIBRARY_SCOPE)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const groups = await groupsByContent(rows.map((r) => String(r.id)));

  // Materiais enviados por upload ficam em bucket privado: a interface e o
  // CRM de homologação recebem uma URL assinada temporária.
  const uploads = rows
    .map((r) => String(r.url))
    .filter((u) => u.startsWith("storage://"))
    .map((u) => u.replace("storage://", ""));
  const signed = new Map<string, string>();
  if (uploads.length > 0) {
    const { data: urls } = await supabaseAdmin.storage
      .from(LIBRARY_BUCKET)
      .createSignedUrls(uploads, SIGNED_URL_TTL);
    for (const item of urls ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  }

  return rows.map((row) => {
    const raw = String(row.url ?? "");
    const storagePath = raw.startsWith("storage://") ? raw.replace("storage://", "") : null;
    const list = groups.get(String(row.id)) ?? [String(row.content_group)];
    return {
      id: String(row.id),
      group: list[0] ?? String(row.content_group),
      groups: list,
      name: String(row.name),
      description: (row.description as string | null) ?? null,
      kind: row.kind as ValueContent["kind"],
      mimeType: (row.mime_type as string | null) ?? null,
      lastUsedAt: (row.last_used_at as string | null) ?? null,
      body: ((row as { body?: string | null }).body as string | null) ?? null,
      storagePath,
      url: storagePath ? signed.get(storagePath) ?? "" : raw,
      active: Boolean(row.active),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      usageCount: Number(row.usage_count ?? 0),
    };
  });
}

export type ContentInput = {
  id?: string | null;
  groups: string[];
  name: string;
  description?: string | null;
  kind: ValueContent["kind"];
  url?: string | null;
  body?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  active: boolean;
};

export async function saveValueContent(input: ContentInput): Promise<ValueContent[]> {
  const groups = Array.from(new Set(input.groups));
  if (groups.length === 0) throw new Error("Selecione ao menos um grupo para o conteúdo.");
  for (const g of groups) {
    if (!CONTENT_GROUPS.includes(g as never)) throw new Error(`Grupo de conteúdo desconhecido: ${g}.`);
  }
  const name = input.name.trim();
  const body = input.body?.trim() || null;
  const url = input.storagePath
    ? `storage://${input.storagePath}`
    : (input.url ?? "").trim();
  if (!name) throw new Error("O nome do conteúdo é obrigatório.");
  if (input.kind === "texto") {
    if (!body) throw new Error("Informe o texto do conteúdo.");
  } else if (!url) {
    throw new Error("Envie um arquivo ou informe o link do conteúdo.");
  }

  const payload = {
    scope: LIBRARY_SCOPE,
    content_group: groups[0]!,
    name,
    description: input.description?.trim() || null,
    kind: input.kind,
    mime_type: input.mimeType ?? null,
    url,
    body,
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  let contentId = input.id ?? null;
  if (contentId) {
    const { error } = await supabaseAdmin
      .from("relationship_contents")
      .update(payload)
      .eq("id", contentId)
      .eq("scope", LIBRARY_SCOPE);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabaseAdmin
      .from("relationship_contents")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    contentId = String(data.id);
  }

  // Associações: um conteúdo físico, N grupos.
  await supabaseAdmin.from("relationship_content_groups").delete().eq("content_id", contentId);
  const { error: linkError } = await supabaseAdmin
    .from("relationship_content_groups")
    .insert(groups.map((g) => ({ content_id: contentId, content_group: g })));
  if (linkError) throw new Error(linkError.message);

  return listValueContents();
}

/** Ativar/desativar sem perder histórico (COMANDO 3C §17). */
export async function setValueContentActive(id: string, active: boolean): Promise<ValueContent[]> {
  const { error } = await supabaseAdmin
    .from("relationship_contents")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("scope", LIBRARY_SCOPE);
  if (error) throw new Error(error.message);
  return listValueContents();
}

/**
 * Exclusão física só quando não compromete auditoria (COMANDO 3C §18):
 * conteúdo já utilizado em rodada permanece, apenas é desativado.
 */
export async function deleteValueContent(id: string): Promise<ValueContent[]> {
  const { data: row, error: readError } = await supabaseAdmin
    .from("relationship_contents")
    .select("id,usage_count,url")
    .eq("id", id)
    .eq("scope", LIBRARY_SCOPE)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!row) throw new Error("Conteúdo não encontrado na biblioteca.");
  if (Number(row.usage_count ?? 0) > 0) {
    throw new Error(
      "Este conteúdo já foi utilizado em uma rodada e não pode ser apagado. Desative-o para preservar o histórico.",
    );
  }
  const raw = String(row.url ?? "");
  if (raw.startsWith("storage://")) {
    await supabaseAdmin.storage.from(LIBRARY_BUCKET).remove([raw.replace("storage://", "")]);
  }
  const { error } = await supabaseAdmin
    .from("relationship_contents")
    .delete()
    .eq("id", id)
    .eq("scope", LIBRARY_SCOPE);
  if (error) throw new Error(error.message);
  return listValueContents();
}

/** Upload de material para o bucket privado da biblioteca. */
export async function uploadLibraryFile(input: {
  fileName: string;
  mimeType: string;
  base64: string;
}): Promise<{ storagePath: string }> {
  const clean = input.base64.includes(",") ? input.base64.split(",")[1]! : input.base64;
  const bytes = Buffer.from(clean, "base64");
  if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
  const safe = input.fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `library/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabaseAdmin.storage
    .from(LIBRARY_BUCKET)
    .upload(path, bytes, { contentType: input.mimeType || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
  return { storagePath: path };
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
  const library = await listValueContents();
  const gaps = contentLibraryGaps(library);
  if (gaps.length > 0) {
    throw new Error(
      `A biblioteca de conteúdos ainda está incompleta:\n- ${gaps.join("\n- ")}`,
    );
  }
  const runId = await nextRunId();
  const startedAt = new Date();
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
        contentKind: content?.kind ?? null,
        contentUrl: content?.url ?? null,
        contentGroup: content?.group ?? null,
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
    selections: output.messages
      .filter((m) => m.contentId)
      .map((m) => {
        const content = byId.get(m.contentId!) ?? null;
        return {
          leadId: m.leadId,
          step: m.step,
          contentId: m.contentId,
          contentName: m.contentName ?? content?.name ?? "—",
          contentUrl: content?.url ?? null,
          contentGroup: content?.group ?? null,
          /** Data simulada do cenário (relógio virtual). */
          simulatedAt: m.at,
        };
      }),
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
