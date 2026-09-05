/**
 * CENTRAL DE OPERAÇÕES (/f) — CAMADA DE LEITURA.
 *
 * Este módulo NÃO cria, NÃO executa, NÃO conclui, NÃO pula e NÃO
 * agenda nada. Ele apenas LÊ as fontes primárias já existentes,
 * normaliza e consolida. Não existe segundo ledger, nenhuma tabela
 * nova de "ações da Central".
 *
 * FONTE PRIMÁRIA POR TIPO (nada mais é somado):
 *   mensagem        → relationship_queue
 *   ligação         → crm_cadence_tasks
 *   primeiro contato→ workspace_e0_actions
 *   reunião         → portal_meetings
 *   pulo            → relationship_engine_log (action='acao_do_dia_pulada')
 *
 * `relationship_message_sends` é SNAPSHOT/DETALHE de mensagem;
 * `crm_timeline` é espelho humano. Nenhum dos dois é contado.
 *
 * RESPONSÁVEL DA AÇÃO:
 *   mensagem → relationship_queue.responsible_executive_id (snapshot do
 *              nascimento). NULL ⇒ "responsável histórico não
 *              registrado" — nunca preenchido com o dono atual.
 *   ligação  → completed_by (quem executou); pendente fica sem
 *              responsável histórico.
 *   E0       → workspace_e0_actions.responsible_executive_id
 *   reunião  → portal_meetings.executive_id
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const UNASSIGNED_EXECUTIVE = "__sem_responsavel_historico__";
export const UNASSIGNED_LABEL = "Responsável histórico não registrado";

export type OperationsKind = "mensagem" | "ligacao" | "e0" | "reuniao";
export type OperationsStatus =
  | "executada"
  | "pendente"
  | "cancelada"
  | "nao_realizada";

export type OperationsAction = {
  /** Identificador rastreável da ação na sua fonte primária. */
  id: string;
  source: string;
  kind: OperationsKind;
  step: string | null;
  status: OperationsStatus;
  /** Derivada: pendente com data planejada anterior ao instante atual. */
  overdue: boolean;
  plannedAt: string | null;
  executedAt: string | null;
  result: string | null;
  reason: string | null;
  /** Responsável HISTÓRICO da ação (pode ser nulo — nunca inventado). */
  executiveId: string | null;
  executiveName: string | null;
  /** Dono ATUAL do lead — informação separada, apenas contextual. */
  currentOwnerId: string | null;
  investorId: string | null;
  investorName: string | null;
  scope: string | null;
  /** Detalhe imutável já existente (snapshot de mensagem), quando houver. */
  snapshot: {
    libraryCode: string | null;
    libraryVersion: number | null;
    body: string | null;
    contentUrl: string | null;
    sentAt: string | null;
    origin: string | null;
    simulated: boolean | null;
  } | null;
};

export type OperationsSkip = {
  id: string;
  actionKey: string | null;
  kind: string | null;
  step: string | null;
  title: string | null;
  motivo: string | null;
  executiveId: string | null;
  executiveName: string | null;
  investorId: string | null;
  investorName: string | null;
  at: string;
};

export type ExecutiveSummary = {
  executiveId: string;
  executiveName: string;
  planejadas: number;
  executadas: number;
  pendentes: number;
  puladas: number;
  canceladas: number;
  vencidas: number;
  porTipo: Record<OperationsKind, number>;
  taxaExecucao: number | null;
  taxaSkip: number | null;
};

export type OperationsReport = {
  from: string;
  to: string;
  generatedAt: string;
  totals: ExecutiveSummary;
  executives: ExecutiveSummary[];
  motivos: Array<{ motivo: string; total: number }>;
  actions: OperationsAction[];
  skips: OperationsSkip[];
};

function emptySummary(executiveId: string, executiveName: string): ExecutiveSummary {
  return {
    executiveId,
    executiveName,
    planejadas: 0,
    executadas: 0,
    pendentes: 0,
    puladas: 0,
    canceladas: 0,
    vencidas: 0,
    porTipo: { mensagem: 0, ligacao: 0, e0: 0, reuniao: 0 },
    taxaExecucao: null,
    taxaSkip: null,
  };
}

const CANCELLED_MEETING = new Set(["cancelada", "cancelado", "cancelled"]);
const DONE_MEETING = new Set(["realizada", "concluida", "concluída", "realizado"]);
const NO_SHOW_MEETING = new Set(["nao compareceu", "não compareceu", "no-show", "nao realizada", "não realizada"]);

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

async function executiveNames(): Promise<{
  byExecutiveId: Map<string, string>;
  byUserId: Map<string, { id: string; name: string }>;
}> {
  const { data } = await supabaseAdmin
    .from("executive_profiles")
    .select("user_id,executive_id,name");
  const byExecutiveId = new Map<string, string>();
  const byUserId = new Map<string, { id: string; name: string }>();
  for (const row of data ?? []) {
    const id = String(row.executive_id ?? "");
    const name = String(row.name ?? id);
    if (id) byExecutiveId.set(id, name);
    if (row.user_id) byUserId.set(String(row.user_id), { id, name });
  }
  return { byExecutiveId, byUserId };
}

export type OperationsInput = {
  /** Início do período (ISO). */
  from: string;
  /** Fim do período, exclusivo (ISO). */
  to: string;
  nowIso?: string;
};

export async function buildOperationsReport(input: OperationsInput): Promise<OperationsReport> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const now = new Date(nowIso).getTime();
  const fromDate = input.from.slice(0, 10);
  const toDate = input.to.slice(0, 10);

  const [{ byExecutiveId, byUserId }, queueRes, callsRes, e0Res, meetingsRes, skipRes] =
    await Promise.all([
      executiveNames(),
      supabaseAdmin
        .from("relationship_queue")
        .select(
          "id,scope,lead_id,flow,step,due_at,status,executed_at,result,reason,responsible_executive_id,flow_version_id",
        )
        .gte("due_at", input.from)
        .lt("due_at", input.to)
        .limit(2000),
      supabaseAdmin
        .from("crm_cadence_tasks")
        .select("id,lead_id,channel,step_day,step_key,due_date,status,outcome,completed_at,completed_by,note")
        .gte("due_date", fromDate)
        .lte("due_date", toDate)
        .limit(2000),
      supabaseAdmin
        .from("workspace_e0_actions")
        .select(
          "id,card_id,lead_name,responsible_executive_id,state,created_at,executed_at,executed_by,result,note",
        )
        .gte("created_at", input.from)
        .lt("created_at", input.to)
        .limit(2000),
      supabaseAdmin
        .from("portal_meetings")
        .select("id,investor_id,investor_name,executive_id,executive_name,scheduled_at,status,topic,cancel_reason")
        .gte("scheduled_at", input.from)
        .lt("scheduled_at", input.to)
        .limit(2000),
      supabaseAdmin
        .from("relationship_engine_log")
        .select("id,scope,actor,details,created_at")
        .eq("action", "acao_do_dia_pulada")
        .gte("created_at", input.from)
        .lt("created_at", input.to)
        .limit(2000),
    ]);

  const queue = queueRes.data ?? [];
  const calls = callsRes.data ?? [];
  const e0 = e0Res.data ?? [];
  const meetings = meetingsRes.data ?? [];
  const skipLogs = skipRes.data ?? [];

  /* ---- identidades (somente leitura) --------------------------------- */
  const portalIds = new Set<string>();
  for (const row of queue) if (row.lead_id) portalIds.add(String(row.lead_id));
  for (const row of e0) if (row.card_id) portalIds.add(String(row.card_id));
  for (const row of meetings) if (row.investor_id) portalIds.add(String(row.investor_id));
  for (const row of skipLogs) {
    const leadId = (row.details as any)?.leadId;
    if (leadId) portalIds.add(String(leadId));
  }

  const crmIds = [...new Set(calls.map((c) => String(c.lead_id)).filter(Boolean))];
  const crmMap = new Map<string, { portalId: string; name: string }>();
  if (crmIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("crm_leads")
      .select("id,name,external_id")
      .in("id", crmIds);
    for (const row of data ?? []) {
      const portalId = row.external_id ? `gs_${row.external_id}` : "";
      crmMap.set(String(row.id), { portalId, name: String(row.name ?? "Investidor") });
      if (portalId) portalIds.add(portalId);
    }
  }

  const leadMap = new Map<string, { name: string; scope: string | null; owner: string | null }>();
  if (portalIds.size > 0) {
    const { data } = await supabaseAdmin
      .from("portal_leads")
      .select("id,name,scope,responsible_executive_id")
      .in("id", [...portalIds]);
    for (const row of data ?? []) {
      leadMap.set(String(row.id), {
        name: String(row.name ?? "Investidor"),
        scope: (row.scope as string | null) ?? null,
        owner: (row.responsible_executive_id as string | null) ?? null,
      });
    }
  }

  /* ---- snapshot de mensagem (DETALHE, nunca contagem) ----------------- */
  const sendsByKey = new Map<string, any>();
  const queueLeadIds = [...new Set(queue.map((q) => String(q.lead_id)).filter(Boolean))];
  if (queueLeadIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("relationship_message_sends")
      .select("lead_id,step,library_code,library_version,rendered_body,content_url,sent_at,origin,simulated")
      .in("lead_id", queueLeadIds)
      .limit(3000);
    for (const row of data ?? []) {
      sendsByKey.set(`${row.lead_id}::${row.step}`, row);
    }
  }

  /* ---- normalização --------------------------------------------------- */
  const actions: OperationsAction[] = [];

  for (const row of queue) {
    const lead = leadMap.get(String(row.lead_id));
    const status: OperationsStatus =
      row.status === "EXECUTED"
        ? "executada"
        : row.status === "CANCELLED"
          ? "cancelada"
          : "pendente";
    const execId = (row.responsible_executive_id as string | null) ?? null;
    const snap = sendsByKey.get(`${row.lead_id}::${row.step}`) ?? null;
    actions.push({
      id: String(row.id),
      source: "relationship_queue",
      kind: "mensagem",
      step: row.step ? String(row.step) : null,
      status,
      overdue: status === "pendente" && !!row.due_at && new Date(row.due_at).getTime() < now,
      plannedAt: (row.due_at as string | null) ?? null,
      executedAt: (row.executed_at as string | null) ?? null,
      result: (row.result as string | null) ?? null,
      reason: (row.reason as string | null) ?? null,
      executiveId: execId,
      executiveName: execId ? (byExecutiveId.get(execId) ?? execId) : null,
      currentOwnerId: lead?.owner ?? null,
      investorId: String(row.lead_id),
      investorName: lead?.name ?? "Investidor",
      scope: (row.scope as string | null) ?? lead?.scope ?? null,
      snapshot: snap
        ? {
            libraryCode: snap.library_code ?? null,
            libraryVersion: snap.library_version ?? null,
            body: snap.rendered_body ?? null,
            contentUrl: snap.content_url ?? null,
            sentAt: snap.sent_at ?? null,
            origin: snap.origin ?? null,
            simulated: snap.simulated ?? null,
          }
        : null,
    });
  }

  for (const row of calls) {
    const crm = crmMap.get(String(row.lead_id));
    const lead = crm?.portalId ? leadMap.get(crm.portalId) : undefined;
    const done = String(row.status ?? "") === "DONE";
    const executor = row.completed_by ? byUserId.get(String(row.completed_by)) : undefined;
    actions.push({
      id: String(row.id),
      source: "crm_cadence_tasks",
      kind: "ligacao",
      step: (row.step_key as string | null) ?? (row.step_day ? `L${row.step_day}` : null),
      status: done ? "executada" : "pendente",
      overdue: !done && !!row.due_date && new Date(`${row.due_date}T23:59:59Z`).getTime() < now,
      plannedAt: row.due_date ? `${row.due_date}T00:00:00.000Z` : null,
      executedAt: (row.completed_at as string | null) ?? null,
      result:
        row.outcome === "SIM" ? "Atendeu" : row.outcome === "NAO" ? "Não atendeu" : null,
      reason: (row.note as string | null) ?? null,
      executiveId: executor?.id ?? null,
      executiveName: executor?.name ?? null,
      currentOwnerId: lead?.owner ?? null,
      investorId: crm?.portalId || null,
      investorName: crm?.name ?? lead?.name ?? "Investidor",
      scope: lead?.scope ?? null,
      snapshot: null,
    });
  }

  for (const row of e0) {
    const lead = leadMap.get(String(row.card_id));
    const state = String(row.state ?? "");
    const status: OperationsStatus =
      state === "EXECUTADA" ? "executada" : state === "CANCELADA" ? "cancelada" : "pendente";
    const execId = (row.responsible_executive_id as string | null) ?? null;
    actions.push({
      id: String(row.id),
      source: "workspace_e0_actions",
      kind: "e0",
      step: "E0",
      status,
      overdue: status === "pendente" && !!row.created_at && new Date(row.created_at).getTime() < now,
      plannedAt: (row.created_at as string | null) ?? null,
      executedAt: (row.executed_at as string | null) ?? null,
      result: (row.result as string | null) ?? null,
      reason: (row.note as string | null) ?? null,
      executiveId: execId,
      executiveName: execId ? (byExecutiveId.get(execId) ?? execId) : null,
      currentOwnerId: lead?.owner ?? null,
      investorId: String(row.card_id),
      investorName: lead?.name ?? (row.lead_name as string | null) ?? "Investidor",
      scope: lead?.scope ?? null,
      snapshot: null,
    });
  }

  for (const row of meetings) {
    const lead = row.investor_id ? leadMap.get(String(row.investor_id)) : undefined;
    const raw = normalize(row.status as string | null);
    const status: OperationsStatus = CANCELLED_MEETING.has(raw)
      ? "cancelada"
      : DONE_MEETING.has(raw)
        ? "executada"
        : NO_SHOW_MEETING.has(raw)
          ? "nao_realizada"
          : "pendente";
    const execId = (row.executive_id as string | null) ?? null;
    actions.push({
      id: String(row.id),
      source: "portal_meetings",
      kind: "reuniao",
      step: (row.topic as string | null) ?? "Reunião",
      status,
      overdue:
        status === "pendente" && !!row.scheduled_at && new Date(row.scheduled_at).getTime() < now,
      plannedAt: (row.scheduled_at as string | null) ?? null,
      executedAt: status === "executada" ? ((row.scheduled_at as string | null) ?? null) : null,
      result: (row.status as string | null) ?? null,
      reason: (row.cancel_reason as string | null) ?? null,
      executiveId: execId,
      executiveName: execId
        ? (byExecutiveId.get(execId) ?? (row.executive_name as string | null) ?? execId)
        : null,
      currentOwnerId: lead?.owner ?? null,
      investorId: row.investor_id ? String(row.investor_id) : null,
      investorName: lead?.name ?? (row.investor_name as string | null) ?? "Investidor",
      scope: lead?.scope ?? null,
      snapshot: null,
    });
  }

  /* ---- pulos: fonte exclusiva relationship_engine_log ----------------- */
  const skips: OperationsSkip[] = skipLogs.map((row) => {
    const d = (row.details ?? {}) as Record<string, any>;
    const execId = (d["executivo"] as string | null) ?? (row.actor as string | null) ?? null;
    const leadId = d["leadId"] ? String(d["leadId"]) : null;
    return {
      id: String(row.id),
      actionKey: d["actionKey"] ? String(d["actionKey"]) : null,
      kind: d["kind"] ? String(d["kind"]) : null,
      step: d["step"] ? String(d["step"]) : null,
      title: d["title"] ? String(d["title"]) : null,
      motivo: d["motivo"] ? String(d["motivo"]) : null,
      executiveId: execId,
      executiveName: execId ? (byExecutiveId.get(execId) ?? execId) : null,
      investorId: leadId,
      investorName: leadId ? (leadMap.get(leadId)?.name ?? "Investidor") : null,
      at: String(d["at"] ?? row.created_at),
    };
  });

  /* ---- consolidação por executivo ------------------------------------- */
  const buckets = new Map<string, ExecutiveSummary>();
  const bucketFor = (id: string | null, name: string | null) => {
    const key = id ?? UNASSIGNED_EXECUTIVE;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = emptySummary(key, id ? (name ?? id) : UNASSIGNED_LABEL);
      buckets.set(key, bucket);
    }
    return bucket;
  };

  const totals = emptySummary("__totais__", "Operação");

  for (const action of actions) {
    const bucket = bucketFor(action.executiveId, action.executiveName);
    for (const target of [bucket, totals]) {
      target.planejadas += 1;
      target.porTipo[action.kind] += 1;
      if (action.status === "executada") target.executadas += 1;
      else if (action.status === "cancelada") target.canceladas += 1;
      else if (action.status === "nao_realizada") target.canceladas += 0;
      else target.pendentes += 1;
      if (action.overdue) target.vencidas += 1;
    }
    if (action.status === "nao_realizada") {
      bucket.canceladas += 0;
    }
  }

  for (const skip of skips) {
    const bucket = bucketFor(skip.executiveId, skip.executiveName);
    bucket.puladas += 1;
    totals.puladas += 1;
  }

  const finish = (s: ExecutiveSummary) => {
    s.taxaExecucao = s.planejadas > 0 ? Math.round((s.executadas / s.planejadas) * 100) : null;
    const base = s.executadas + s.puladas;
    s.taxaSkip = base > 0 ? Math.round((s.puladas / base) * 100) : null;
    return s;
  };

  const motivos = new Map<string, number>();
  for (const skip of skips) {
    const key = skip.motivo?.trim() || "Sem motivo informado";
    motivos.set(key, (motivos.get(key) ?? 0) + 1);
  }

  return {
    from: input.from,
    to: input.to,
    generatedAt: nowIso,
    totals: finish(totals),
    executives: [...buckets.values()]
      .map(finish)
      .sort((a, b) => b.planejadas - a.planejadas || a.executiveName.localeCompare(b.executiveName)),
    motivos: [...motivos.entries()]
      .map(([motivo, total]) => ({ motivo, total }))
      .sort((a, b) => b.total - a.total),
    actions: actions.sort((a, b) => (b.plannedAt ?? "").localeCompare(a.plannedAt ?? "")),
    skips: skips.sort((a, b) => b.at.localeCompare(a.at)),
  };
}
