/**
 * CENTRAL DE OPERAÇÕES (/f) — RELATÓRIO DO QUE ACONTECEU. SERVER ONLY.
 *
 * Esta camada é ESTRITAMENTE DE LEITURA. Ela não cria ação, não executa,
 * não conclui, não pula, não reagenda, não move cadência e não escreve
 * absolutamente nada. Nenhuma tabela nova, nenhuma segunda fonte de
 * verdade: a produção é reconstruída dos registros oficiais que a
 * própria Ação do Dia já grava.
 *
 * INDICADORES — nada além disto é contado:
 *   ligações efetuadas  → relationship_queue (ação interna de ligação da
 *                         régua V2, status EXECUTED). Esta é a operação
 *                         ATUAL; a tabela legada `crm_cadence_tasks` não
 *                         recebe mais ligações e não é consultada.
 *   mensagens copiadas  → relationship_engine_log
 *                         acao_do_dia_mensagem_registrada com resultado
 *                         "copiada" (conclusão real) ou "enviada".
 *                         "registrada" é repetição de confirmação e NÃO
 *                         conta.
 *   mensagens enviadas  → subconjunto com resultado "enviada". Copiar
 *                         NUNCA é convertido em envio.
 *   reuniões realizadas → relationship_engine_log
 *                         acao_do_dia_reuniao_resolvida, resultado
 *                         "compareceu" (não comparecimento não conta)
 *   pulos               → relationship_engine_log acao_do_dia_pulada
 *   recuperadas         → relationship_engine_log
 *                         acao_do_dia_pulo_recuperado, contadas à parte
 *
 * E0 fica FORA: o primeiro contato nunca gera estes registros e o tipo
 * `primeiro_contato` é descartado explicitamente como segunda barreira.
 * Homologação/simulação fica fora: o ledger é lido apenas em
 * `scope = production` e as ligações de leads de teste são ignoradas.
 *
 * EXECUTOR: normalizado SOMENTE NA LEITURA. As ligações guardam o
 * usuário de login (`completed_by`); o ledger guarda ora o executivo,
 * ora o usuário. Ambos são convertidos para o mesmo `executive_id`
 * através de `executive_profiles`. Sem associação segura, o registro
 * vai para "Não identificado" — jamais por inferência.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { operationalDate } from "@/lib/crm/daily-actions";

export const UNIDENTIFIED_EXECUTIVE = "__nao_identificado__";
export const UNIDENTIFIED_LABEL = "Não identificado";

export type ProductionCounts = {
  ligacoes: number;
  /** Mensagens preparadas/copiadas na Ação do Dia (conclusão real). */
  mensagens: number;
  /** Subconjunto com envio explicitamente registrado. */
  enviadas: number;
  reunioes: number;
  pulos: number;
  /** Pendências puladas e depois efetivamente concluídas. */
  recuperadas: number;
  total: number;
};

export type ExecutiveProduction = ProductionCounts & {
  executiveId: string;
  executiveName: string;
};

export type DayProduction = ProductionCounts & { date: string };

export type SkipRecord = {
  id: string;
  at: string;
  date: string;
  executiveId: string;
  executiveName: string;
  investorId: string | null;
  investorName: string | null;
  step: string | null;
  motivo: string | null;
  /** Concluída depois: continua no histórico, mas não conta como pulo. */
  recuperada: boolean;
};

export type ProductionReport = {
  /** Datas operacionais (YYYY-MM-DD) do período, inclusivas. */
  from: string;
  to: string;
  scope: "equipe" | "propria";
  generatedAt: string;
  totals: ProductionCounts;
  executives: ExecutiveProduction[];
  days: DayProduction[];
  skips: SkipRecord[];
};

function emptyCounts(): ProductionCounts {
  return { ligacoes: 0, mensagens: 0, reunioes: 0, pulos: 0, total: 0 };
}

/** Um acontecimento já concluído, normalizado para contagem. */
type Event = {
  key: string;
  metric: "ligacoes" | "mensagens" | "reunioes" | "pulos";
  date: string;
  executiveId: string;
};

type Directory = {
  nameByExecutiveId: Map<string, string>;
  executiveIdByUserId: Map<string, string>;
  /** Executivos operacionais: gestão pura fica de fora do relatório. */
  operational: Array<{ executiveId: string; name: string }>;
};

async function loadDirectory(): Promise<Directory> {
  const [{ data: profiles }, { data: roles }, { data: status }] = await Promise.all([
    supabaseAdmin.from("executive_profiles").select("user_id,executive_id,name"),
    supabaseAdmin.from("user_roles").select("user_id,role"),
    supabaseAdmin.from("executive_user_status").select("executive_id,status"),
  ]);

  const managerOnly = new Set<string>();
  const adminUsers = new Set<string>();
  for (const row of (roles ?? []) as Array<{ user_id: string; role: string }>) {
    if (row.role === "admin") adminUsers.add(String(row.user_id));
  }
  for (const row of (roles ?? []) as Array<{ user_id: string; role: string }>) {
    if (row.role === "manager" && !adminUsers.has(String(row.user_id))) {
      managerOnly.add(String(row.user_id));
    }
  }

  const inactive = new Set(
    ((status ?? []) as Array<{ executive_id: string; status: string }>)
      .filter((s) => s.status === "inativo")
      .map((s) => String(s.executive_id)),
  );

  const nameByExecutiveId = new Map<string, string>();
  const executiveIdByUserId = new Map<string, string>();
  const operational: Array<{ executiveId: string; name: string }> = [];

  for (const row of (profiles ?? []) as Array<{
    user_id: string | null;
    executive_id: string | null;
    name: string | null;
  }>) {
    const executiveId = String(row.executive_id ?? "");
    if (!executiveId) continue;
    const name = String(row.name ?? executiveId);
    nameByExecutiveId.set(executiveId, name);
    if (row.user_id) executiveIdByUserId.set(String(row.user_id), executiveId);
    /**
     * GESTÃO NÃO É OPERAÇÃO. Quem tem apenas papel de gestão não possui
     * Ação do Dia e por isso nunca vira linha de produção.
     */
    const isManagerOnly = row.user_id ? managerOnly.has(String(row.user_id)) : false;
    if (!isManagerOnly && !inactive.has(executiveId)) {
      operational.push({ executiveId, name });
    }
  }

  operational.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { nameByExecutiveId, executiveIdByUserId, operational };
}

/** Converte qualquer autor gravado (executivo ou usuário) em executivo. */
function normalizeActor(raw: unknown, dir: Directory): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return UNIDENTIFIED_EXECUTIVE;
  if (dir.nameByExecutiveId.has(value)) return value;
  const mapped = dir.executiveIdByUserId.get(value);
  return mapped ?? UNIDENTIFIED_EXECUTIVE;
}

/** Lista de datas operacionais do período (dias sem produção incluídos). */
function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (let d = start; d.getTime() <= end.getTime(); d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10));
    if (out.length > 400) break;
  }
  return out;
}

type LedgerRow = {
  id: string;
  actor: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
};

function detailDate(details: Record<string, unknown>, fallbackIso: string): string {
  const declared = details["operationalDate"];
  if (typeof declared === "string" && declared.length === 10) return declared;
  const at = details["at"];
  return operationalDate(typeof at === "string" ? at : fallbackIso);
}

function detailString(details: Record<string, unknown>, key: string): string | null {
  const value = details[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export type ProductionInput = {
  /** Datas operacionais inclusivas (YYYY-MM-DD). */
  from: string;
  to: string;
  scope: "equipe" | "propria";
  /** Quando o escopo é próprio, o executivo já resolvido pelo servidor. */
  executiveId?: string | null;
  nowIso?: string;
};

export async function buildProductionReport(
  input: ProductionInput,
): Promise<ProductionReport> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const days = dayRange(input.from, input.to);
  const dir = await loadDirectory();

  /**
   * JANELA DE CONSULTA FOLGADA: as datas do relatório são OPERACIONAIS
   * (São Paulo) e o banco guarda instantes UTC. Buscamos um dia a mais
   * de cada lado e filtramos pela data operacional — assim existe uma
   * única definição de dia em toda a aplicação.
   */
  const windowFrom = new Date(`${input.from}T00:00:00Z`).getTime() - 86400000;
  const windowTo = new Date(`${input.to}T00:00:00Z`).getTime() + 2 * 86400000;
  const fromIso = new Date(windowFrom).toISOString();
  const toIso = new Date(windowTo).toISOString();

  const [callsRes, ledgerRes] = await Promise.all([
    supabaseAdmin
      .from("crm_cadence_tasks")
      .select("id,lead_id,channel,status,completed_at,completed_by")
      .eq("channel", "call")
      .eq("status", "DONE")
      .gte("completed_at", fromIso)
      .lt("completed_at", toIso)
      .limit(5000),
    supabaseAdmin
      .from("relationship_engine_log")
      .select("id,action,actor,details,created_at")
      .eq("scope", "production")
      .in("action", [
        "acao_do_dia_mensagem_registrada",
        "acao_do_dia_reuniao_resolvida",
        "acao_do_dia_pulada",
        "acao_do_dia_pulo_recuperado",
      ])
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .limit(5000),
  ]);

  const callRows = (callsRes.data ?? []) as Array<{
    id: string;
    lead_id: string | null;
    completed_at: string | null;
    completed_by: string | null;
  }>;

  /** HOMOLOGAÇÃO/TESTE FORA: leads de teste não são produção real. */
  const leadIds = [...new Set(callRows.map((r) => r.lead_id).filter(Boolean))] as string[];
  const testLeads = new Set<string>();
  if (leadIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("crm_leads")
      .select("id,is_test,environment")
      .in("id", leadIds);
    for (const row of (data ?? []) as Array<{
      id: string;
      is_test: boolean | null;
      environment: string | null;
    }>) {
      const foreign = row.environment != null && row.environment !== "production";
      if (row.is_test === true || foreign) testLeads.add(String(row.id));
    }
  }

  const events: Event[] = [];
  const seen = new Set<string>();
  const push = (event: Event) => {
    if (seen.has(event.key)) return;
    seen.add(event.key);
    events.push(event);
  };

  for (const row of callRows) {
    if (!row.completed_at) continue;
    if (row.lead_id && testLeads.has(String(row.lead_id))) continue;
    push({
      key: `ligacao:${row.id}`,
      metric: "ligacoes",
      date: operationalDate(row.completed_at),
      executiveId: normalizeActor(row.completed_by, dir),
    });
  }

  const skips: SkipRecord[] = [];
  const ledgerWithAction = (ledgerRes.data ?? []) as Array<
    LedgerRow & { action?: string | null }
  >;

  /**
   * RECUPERAÇÃO: a ação pulada que foi concluída depois deixa de contar
   * como pulo. O registro original permanece intacto no histórico.
   */
  const recoveredKeys = new Set<string>();
  for (const row of ledgerWithAction) {
    if (String(row.action ?? "") !== "acao_do_dia_pulo_recuperado") continue;
    const key = detailString((row.details ?? {}) as Record<string, unknown>, "actionKey");
    if (key) recoveredKeys.add(key);
  }

  for (const row of ledgerWithAction) {
    /** O tipo do registro vem da própria linha; nada é inferido. */
    const action = String(row.action ?? "");
    const details = (row.details ?? {}) as Record<string, unknown>;
    /** E0 nunca é produção da Central, em nenhuma métrica. */
    if (detailString(details, "kind") === "primeiro_contato") continue;

    const date = detailDate(details, row.created_at);
    if (!days.includes(date)) continue;
    const executiveId = normalizeActor(
      detailString(details, "executivo") ?? row.actor,
      dir,
    );
    const actionKey = detailString(details, "actionKey") ?? String(row.id);

    if (action === "acao_do_dia_mensagem_registrada") {
      // Somente conclusão real: repetição grava "registrada".
      if (detailString(details, "resultado") !== "enviada") continue;
      const queueItemId = detailString(details, "queueItemId") ?? actionKey;
      push({ key: `mensagem:${queueItemId}`, metric: "mensagens", date, executiveId });
      continue;
    }

    if (action === "acao_do_dia_reuniao_resolvida") {
      if (detailString(details, "resultado") !== "compareceu") continue;
      const meetingId = detailString(details, "meetingId") ?? actionKey;
      push({ key: `reuniao:${meetingId}`, metric: "reunioes", date, executiveId });
      continue;
    }

    if (action === "acao_do_dia_pulada") {
      const recuperada = recoveredKeys.has(actionKey);
      const key = `pulo:${actionKey}:${date}`;
      if (seen.has(key)) continue;
      if (!recuperada) push({ key, metric: "pulos", date, executiveId });
      skips.push({
        id: String(row.id),
        at: detailString(details, "at") ?? row.created_at,
        date,
        executiveId,
        executiveName:
          executiveId === UNIDENTIFIED_EXECUTIVE
            ? UNIDENTIFIED_LABEL
            : (dir.nameByExecutiveId.get(executiveId) ?? executiveId),
        investorId: detailString(details, "leadId"),
        investorName: detailString(details, "title"),
        step: detailString(details, "step"),
        motivo: detailString(details, "motivo"),
        recuperada,
      });
    }
  }

  /** Recorte de escopo — decidido pelo servidor, nunca pelo navegador. */
  const ownExecutive = input.scope === "propria" ? (input.executiveId ?? null) : null;
  const visible = events.filter((e) => {
    if (!days.includes(e.date)) return false;
    if (input.scope === "propria") return ownExecutive != null && e.executiveId === ownExecutive;
    return true;
  });
  const visibleSkips = skips.filter((s) =>
    input.scope === "propria" ? ownExecutive != null && s.executiveId === ownExecutive : true,
  );

  const totals = emptyCounts();
  const byExecutive = new Map<string, ProductionCounts>();
  const byDay = new Map<string, ProductionCounts>();
  for (const day of days) byDay.set(day, emptyCounts());

  const bump = (bucket: ProductionCounts, metric: Event["metric"]) => {
    bucket[metric] += 1;
    bucket.total += 1;
  };

  for (const event of visible) {
    bump(totals, event.metric);
    const exec = byExecutive.get(event.executiveId) ?? emptyCounts();
    bump(exec, event.metric);
    byExecutive.set(event.executiveId, exec);
    const day = byDay.get(event.date) ?? emptyCounts();
    bump(day, event.metric);
    byDay.set(event.date, day);
  }

  const executives: ExecutiveProduction[] = [];
  if (input.scope === "equipe") {
    for (const person of dir.operational) {
      executives.push({
        executiveId: person.executiveId,
        executiveName: person.name,
        ...(byExecutive.get(person.executiveId) ?? emptyCounts()),
      });
    }
    // Autores presentes nos registros que não estão na lista operacional
    // (histórico antigo, cadastro inativo, autoria não identificada).
    for (const [executiveId, counts] of byExecutive) {
      if (executives.some((e) => e.executiveId === executiveId)) continue;
      executives.push({
        executiveId,
        executiveName:
          executiveId === UNIDENTIFIED_EXECUTIVE
            ? UNIDENTIFIED_LABEL
            : (dir.nameByExecutiveId.get(executiveId) ?? executiveId),
        ...counts,
      });
    }
    executives.sort((a, b) => b.total - a.total || a.executiveName.localeCompare(b.executiveName, "pt-BR"));
  }

  return {
    from: input.from,
    to: input.to,
    scope: input.scope,
    generatedAt: nowIso,
    totals,
    executives,
    days: days
      .map((date) => ({ date, ...(byDay.get(date) ?? emptyCounts()) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    skips: visibleSkips.sort((a, b) => (a.at < b.at ? 1 : -1)),
  };
}
