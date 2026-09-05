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
 * DUAS LEITURAS, NUNCA SOMADAS:
 *   ADERÊNCIA  → obrigações cuja data PLANEJADA cai no período.
 *   PRODUÇÃO   → ações cuja data de EXECUÇÃO cai no período.
 * A mesma ação pode pertencer às duas (planejada e executada no mesmo
 * período) — cada visão a conta uma única vez, e as visões nunca são
 * adicionadas uma à outra.
 *
 * RESPONSÁVEL DA AÇÃO (snapshot histórico, jamais recalculado):
 *   mensagem → relationship_queue.responsible_executive_id
 *   ligação  → crm_cadence_tasks.responsible_executive_id (nascimento
 *              da obrigação); quando NULL, cai em "responsável
 *              histórico não registrado" — nunca o dono atual.
 *   E0       → workspace_e0_actions.responsible_executive_id
 *   reunião  → portal_meetings.executive_id
 *
 * PRAZO: só há vencimento onde existe prazo formal — mensagem (due_at),
 * ligação (due_date) e reunião (scheduled_at). E0 NÃO tem deadline
 * formal na arquitetura, então E0 pendente nunca é marcado como vencido.
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
  /** Derivada: pendente com prazo formal já vencido. Subconjunto de pendentes. */
  overdue: boolean;
  /** Pertence à leitura de ADERÊNCIA (planejada dentro do período). */
  planned: boolean;
  /** Pertence à leitura de PRODUÇÃO (executada dentro do período). */
  produced: boolean;
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
  /** ADERÊNCIA — obrigações com data planejada no período. */
  planejadas: number;
  /** ADERÊNCIA — dessas obrigações, quantas já foram executadas. */
  executadasDoPlanejado: number;
  pendentes: number;
  /** Subconjunto de `pendentes`. Nunca somar. */
  vencidas: number;
  canceladas: number;
  /** PRODUÇÃO — ações executadas dentro do período (âncora de execução). */
  producao: number;
  puladas: number;
  porTipoPlanejado: Record<OperationsKind, number>;
  porTipoProducao: Record<OperationsKind, number>;
  taxaAderencia: number | null;
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
    executadasDoPlanejado: 0,
    pendentes: 0,
    vencidas: 0,
    canceladas: 0,
    producao: 0,
    puladas: 0,
    porTipoPlanejado: { mensagem: 0, ligacao: 0, e0: 0, reuniao: 0 },
    porTipoProducao: { mensagem: 0, ligacao: 0, e0: 0, reuniao: 0 },
    taxaAderencia: null,
    taxaSkip: null,
  };
}

const CANCELLED_MEETING = new Set(["cancelada", "cancelado", "cancelled"]);
const DONE_MEETING = new Set(["realizada", "concluida", "concluída", "realizado"]);
const NO_SHOW_MEETING = new Set([
  "nao compareceu",
  "não compareceu",
  "no-show",
  "nao realizada",
  "não realizada",
]);

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

/** União por chave de origem: a mesma linha nunca vira duas ações. */
function mergeRows<T extends { id: string }>(...groups: (T[] | null | undefined)[]): T[] {
  const map = new Map<string, T>();
  for (const group of groups ?? []) {
    for (const row of group ?? []) map.set(String(row.id), row);
  }
  return [...map.values()];
}

export async function buildOperationsReport(input: OperationsInput): Promise<OperationsReport> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const now = new Date(nowIso).getTime();
  const fromDate = input.from.slice(0, 10);
  const toDate = input.to.slice(0, 10);

  const inWindow = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) return false;
    return t >= new Date(input.from).getTime() && t < new Date(input.to).getTime();
  };

  const queueColumns =
    "id,scope,run_id,lead_id,flow,step,due_at,status,executed_at,result,reason,responsible_executive_id,flow_version_id";
  const callColumns =
    "id,lead_id,channel,step_day,step_key,due_date,status,outcome,completed_at,completed_by,note,responsible_executive_id";
  const e0Columns =
    "id,card_id,lead_name,responsible_executive_id,state,created_at,executed_at,executed_by,result,note";
  const meetingColumns =
    "id,investor_id,investor_name,executive_id,executive_name,scheduled_at,status,topic,cancel_reason";

  const [
    { byExecutiveId, byUserId },
    queuePlannedRes,
    queueDoneRes,
    callsPlannedRes,
    callsDoneRes,
    e0PlannedRes,
    e0DoneRes,
    meetingsRes,
    skipRes,
  ] = await Promise.all([
    executiveNames(),
    /* MENSAGENS — somente produção real do motor: scope production e
       fora de rodada de homologação (run_id nulo). */
    supabaseAdmin
      .from("relationship_queue")
      .select(queueColumns)
      .eq("scope", "production")
      .is("run_id", null)
      .gte("due_at", input.from)
      .lt("due_at", input.to)
      .limit(2000),
    supabaseAdmin
      .from("relationship_queue")
      .select(queueColumns)
      .eq("scope", "production")
      .is("run_id", null)
      .gte("executed_at", input.from)
      .lt("executed_at", input.to)
      .limit(2000),
    supabaseAdmin
      .from("crm_cadence_tasks")
      .select(callColumns)
      .gte("due_date", fromDate)
      .lte("due_date", toDate)
      .limit(2000),
    supabaseAdmin
      .from("crm_cadence_tasks")
      .select(callColumns)
      .gte("completed_at", input.from)
      .lt("completed_at", input.to)
      .limit(2000),
    supabaseAdmin.from("workspace_e0_actions").select(e0Columns).gte("created_at", input.from).lt("created_at", input.to).limit(2000),
    supabaseAdmin.from("workspace_e0_actions").select(e0Columns).gte("executed_at", input.from).lt("executed_at", input.to).limit(2000),
    supabaseAdmin
      .from("portal_meetings")
      .select(meetingColumns)
      .gte("scheduled_at", input.from)
      .lt("scheduled_at", input.to)
      .limit(2000),
    supabaseAdmin
      .from("relationship_engine_log")
      .select("id,scope,actor,details,created_at")
      .eq("action", "acao_do_dia_pulada")
      .eq("scope", "production")
      .gte("created_at", input.from)
      .lt("created_at", input.to)
      .limit(2000),
  ]);

  const queue = mergeRows<any>(queuePlannedRes.data, queueDoneRes.data);
  const calls = mergeRows<any>(callsPlannedRes.data, callsDoneRes.data);
  const e0 = mergeRows<any>(e0PlannedRes.data, e0DoneRes.data);
  const meetings = (meetingsRes.data ?? []) as any[];
  const skipLogs = (skipRes.data ?? []) as any[];

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
  const crmMap = new Map<string, { portalId: string; name: string; isTest: boolean }>();
  if (crmIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("crm_leads")
      .select("id,name,external_id,is_test")
      .in("id", crmIds);
    for (const row of data ?? []) {
      const portalId = row.external_id ? `gs_${row.external_id}` : "";
      crmMap.set(String(row.id), {
        portalId,
        name: String(row.name ?? "Investidor"),
        isTest: Boolean((row as { is_test?: boolean | null }).is_test),
      });
      if (portalId) portalIds.add(portalId);
    }
  }

  const leadMap = new Map<
    string,
    { name: string; scope: string | null; owner: string | null; isTest: boolean }
  >();
  if (portalIds.size > 0) {
    const { data } = await supabaseAdmin
      .from("portal_leads")
      .select("id,name,scope,responsible_executive_id,is_test,test_batch_id")
      .in("id", [...portalIds]);
    for (const row of data ?? []) {
      leadMap.set(String(row.id), {
        name: String(row.name ?? "Investidor"),
        scope: (row.scope as string | null) ?? null,
        owner: (row.responsible_executive_id as string | null) ?? null,
        isTest:
          Boolean((row as { is_test?: boolean | null }).is_test) ||
          Boolean((row as { test_batch_id?: string | null }).test_batch_id),
      });
    }
  }

  /** Nenhum lead de laboratório entra na Central: os dados continuam
   *  existindo, apenas não são contabilizados como produção. */
  const isTestLead = (portalId: string | null | undefined): boolean =>
    portalId ? (leadMap.get(portalId)?.isTest ?? false) : false;

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
    if (isTestLead(row.lead_id ? String(row.lead_id) : null)) continue;
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
      planned: inWindow(row.due_at as string | null),
      produced: status === "executada" && inWindow(row.executed_at as string | null),
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
    if (crm?.isTest || isTestLead(crm?.portalId || null)) continue;
    const lead = crm?.portalId ? leadMap.get(crm.portalId) : undefined;
    const done = String(row.status ?? "") === "DONE";
    const cancelled = String(row.status ?? "") === "CANCELLED";
    /**
     * Responsável HISTÓRICO da ligação = quem detinha o lead quando a
     * obrigação nasceu. Só quando esse snapshot não existe (tarefas
     * anteriores à coluna) usamos quem concluiu — nunca o dono atual.
     */
    const executorFromUser = row.completed_by ? byUserId.get(String(row.completed_by)) : undefined;
    const snapshotExec = (row.responsible_executive_id as string | null) ?? null;
    const execId = snapshotExec ?? executorFromUser?.id ?? null;
    const dueIso = row.due_date ? `${row.due_date}T00:00:00.000Z` : null;
    actions.push({
      id: String(row.id),
      source: "crm_cadence_tasks",
      kind: "ligacao",
      step: (row.step_key as string | null) ?? (row.step_day ? `L${row.step_day}` : null),
      status: done ? "executada" : cancelled ? "cancelada" : "pendente",
      overdue:
        !done &&
        !cancelled &&
        !!row.due_date &&
        new Date(`${row.due_date}T23:59:59Z`).getTime() < now,
      planned: !!row.due_date && row.due_date >= fromDate && row.due_date <= toDate,
      produced: done && inWindow(row.completed_at as string | null),
      plannedAt: dueIso,
      executedAt: (row.completed_at as string | null) ?? null,
      result: row.outcome === "SIM" ? "Atendeu" : row.outcome === "NAO" ? "Não atendeu" : null,
      reason: (row.note as string | null) ?? null,
      executiveId: execId,
      executiveName: execId
        ? (byExecutiveId.get(execId) ?? executorFromUser?.name ?? execId)
        : null,
      currentOwnerId: lead?.owner ?? null,
      investorId: crm?.portalId || null,
      investorName: crm?.name ?? lead?.name ?? "Investidor",
      scope: lead?.scope ?? null,
      snapshot: null,
    });
  }

  for (const row of e0) {
    if (isTestLead(row.card_id ? String(row.card_id) : null)) continue;
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
      /**
       * E0 NÃO tem prazo formal na arquitetura (existe janela
       * operacional, que é permissão de horário, não deadline).
       * Enquanto não houver prazo configurado, E0 nunca é vencido.
       */
      overdue: false,
      planned: inWindow(row.created_at as string | null),
      produced: status === "executada" && inWindow(row.executed_at as string | null),
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
    if (isTestLead(row.investor_id ? String(row.investor_id) : null)) continue;
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
      planned: inWindow(row.scheduled_at as string | null),
      /**
       * Reunião não tem timestamp de desfecho no modelo atual: a
       * produção usa o próprio horário agendado quando o desfecho já é
       * "realizada". Nenhum timestamp é inventado.
       */
      produced: status === "executada" && inWindow(row.scheduled_at as string | null),
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
  const skips: OperationsSkip[] = skipLogs
    .filter((row) => {
      const leadId = (row.details as any)?.leadId;
      return !isTestLead(leadId ? String(leadId) : null);
    })
    .map((row) => {
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
      if (action.planned) {
        target.planejadas += 1;
        target.porTipoPlanejado[action.kind] += 1;
        // Categorias exclusivas dentro da ADERÊNCIA. "Não compareceu" é
        // desfecho próprio e não entra em nenhuma delas.
        if (action.status === "executada") target.executadasDoPlanejado += 1;
        else if (action.status === "cancelada") target.canceladas += 1;
        else if (action.status === "pendente") {
          target.pendentes += 1;
          // OVERDUE é SUBCONJUNTO de pendentes — nunca somado por fora.
          if (action.overdue) target.vencidas += 1;
        }
      }
      if (action.produced) {
        target.producao += 1;
        target.porTipoProducao[action.kind] += 1;
      }
    }
  }

  for (const skip of skips) {
    const bucket = bucketFor(skip.executiveId, skip.executiveName);
    bucket.puladas += 1;
    totals.puladas += 1;
  }

  const finish = (s: ExecutiveSummary) => {
    s.taxaAderencia =
      s.planejadas > 0 ? Math.round((s.executadasDoPlanejado / s.planejadas) * 100) : null;
    const base = s.executadasDoPlanejado + s.puladas;
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
      .sort(
        (a, b) =>
          b.producao - a.producao ||
          b.planejadas - a.planejadas ||
          a.executiveName.localeCompare(b.executiveName),
      ),
    motivos: [...motivos.entries()]
      .map(([motivo, total]) => ({ motivo, total }))
      .sort((a, b) => b.total - a.total),
    actions: actions.sort((a, b) =>
      (b.executedAt ?? b.plannedAt ?? "").localeCompare(a.executedAt ?? a.plannedAt ?? ""),
    ),
    skips: skips.sort((a, b) => b.at.localeCompare(a.at)),
  };
}
