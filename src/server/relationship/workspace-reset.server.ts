/**
 * RESET CONTROLADO DO WORKSPACE DE HOMOLOGAÇÃO (COMANDO 3D §1–§5, §29–§31).
 *
 * ESTE RESET NÃO TOCA:
 *  - Portal dos Leads / GreenSales real (crm_leads, crm_pipelines,
 *    crm_pipeline_stages, crm_cadence_tasks, crm_sync_runs, crm_lead_events);
 *  - leads reais do Portal do Investidor;
 *  - usuários, permissões, templates, Biblioteca de Conteúdos,
 *    configurações do motor e relatórios permanentes de rodadas.
 *
 * Ele remove APENAS registros fictícios de teste do workspace operacional
 * dos executivos e os dados operacionais de escopo "homologation".
 */

/** Tabelas jamais tocadas por este reset (auditoria explícita). */
export const PROTECTED_TABLES = [
  "crm_leads",
  "crm_pipelines",
  "crm_pipeline_stages",
  "crm_cadence_tasks",
  "crm_sync_runs",
  "crm_lead_events",
  "crm_connections",
  "crm_meta_templates",
  "meta_templates",
  "relationship_contents",
  "relationship_content_groups",
  "relationship_sim_runs",
  "user_roles",
  "executive_profiles",
  "portal_backups",
  "knowledge_documents",
] as const;

/** Marcadores inequívocos de registro fictício/de teste. */
const TEST_MARKERS =
  /(test|teste|tst-|auditor|homolog|simul|ficti|fictí|exemplo|demo|lorem|qa-)/i;

export type LeadLike = {
  id: string;
  name?: string | null;
  email?: string | null;
  origin?: string | null;
  external_source?: string | null;
};

/** Registro protegido: origem real (GreenSales/Portal dos Leads). */
export function isProtectedLead(lead: LeadLike): boolean {
  if (/^gs_/i.test(lead.id)) return true;
  if ((lead.external_source ?? "").trim() !== "") return true;
  if (/green\s*sales/i.test(lead.origin ?? "")) return true;
  return false;
}

/**
 * Candidato ao reset: registro fictício do workspace/homologação.
 * Na dúvida o registro é PRESERVADO — nunca apagado.
 */
export function isFictitiousLead(lead: LeadLike): boolean {
  if (isProtectedLead(lead)) return false;
  if (/^TEST-/i.test(lead.id)) return true;
  const haystack = `${lead.id} ${lead.name ?? ""} ${lead.email ?? ""}`;
  if (TEST_MARKERS.test(haystack)) return true;
  // Cadastro manual sem e-mail válido: registro criado apenas para teste.
  const email = (lead.email ?? "").trim();
  const manual = /cadastro manual/i.test(lead.origin ?? "");
  if (manual && !email.includes("@")) return true;
  // Nome puramente numérico é ruído de digitação de teste.
  if (/^\d[\d\s()+-]*$/.test((lead.name ?? "").trim())) return true;
  return false;
}

export type ResetScopeReport = {
  blocked: boolean;
  blockReason: string | null;
  candidates: {
    leads: { id: string; name: string }[];
    protectedLeads: number;
    messages: number;
    timelineNoise: number;
    journeyEvents: number;
    engagement: number;
    homologationRows: number;
  };
  protectedTables: readonly string[];
  portalDosLeadsElegiveis: 0;
  greenSalesElegiveis: 0;
};

type Admin = {
  from: (t: string) => any;
};

async function countOf(supabase: Admin, table: string, apply: (q: any) => any): Promise<number> {
  const { count } = await apply(supabase.from(table).select("*", { count: "exact", head: true }));
  return count ?? 0;
}

/** §29 — validação de escopo antes de qualquer exclusão. */
export async function buildResetScope(supabase: Admin): Promise<ResetScopeReport> {
  const { data: leads } = await supabase
    .from("portal_leads")
    .select("id,name,email,origin,external_source");
  const all = (leads ?? []) as LeadLike[];
  const fictitious = all.filter(isFictitiousLead);
  const ids = fictitious.map((l) => l.id);

  const messages = ids.length
    ? await countOf(supabase, "crm_messages", (q) => q.in("investor_id", ids))
    : 0;
  const timelineNoise = await countOf(supabase, "crm_timeline", (q) =>
    q.eq("event", "duplicidade_detectada"),
  );
  const journeyEvents = ids.length
    ? await countOf(supabase, "portal_journey_events", (q) => q.in("investor_id", ids))
    : 0;
  const engagement = ids.length
    ? await countOf(supabase, "portal_engagement", (q) => q.in("investor_id", ids))
    : 0;
  let homologationRows = 0;
  for (const table of [
    "relationship_cadences",
    "relationship_events",
    "relationship_queue",
    "relationship_decisions",
    "relationship_engine_log",
  ]) {
    homologationRows += await countOf(supabase, table, (q) => q.eq("scope", "homologation"));
  }

  const realLeakage = fictitious.filter(isProtectedLead);
  return {
    blocked: realLeakage.length > 0,
    blockReason:
      realLeakage.length > 0
        ? "Registro real identificado na lista de candidatos — operação bloqueada."
        : null,
    candidates: {
      leads: fictitious.map((l) => ({ id: l.id, name: l.name ?? "—" })),
      protectedLeads: all.length - fictitious.length,
      messages,
      timelineNoise,
      journeyEvents,
      engagement,
      homologationRows,
    },
    protectedTables: PROTECTED_TABLES,
    portalDosLeadsElegiveis: 0,
    greenSalesElegiveis: 0,
  };
}

export type ResetResult = ResetScopeReport & {
  executed: boolean;
  deleted: Record<string, number>;
  totalDeleted: number;
};

/** §30 — execução do reset após validação de escopo. */
export async function executeWorkspaceReset(
  supabase: Admin,
  options: { dryRun: boolean },
): Promise<ResetResult> {
  const scope = await buildResetScope(supabase);
  if (options.dryRun || scope.blocked) {
    return { ...scope, executed: false, deleted: {}, totalDeleted: 0 };
  }
  const ids = scope.candidates.leads.map((l) => l.id);
  const deleted: Record<string, number> = {};

  // Ruído de auditoria gerado por testes antigos (evento repetido em laço).
  await supabase.from("crm_timeline").delete().eq("event", "duplicidade_detectada");
  deleted["crm_timeline"] = scope.candidates.timelineNoise;

  if (ids.length > 0) {
    await supabase.from("crm_messages").delete().in("investor_id", ids);
    deleted["crm_messages"] = scope.candidates.messages;
    await supabase.from("crm_timeline").delete().in("investor_id", ids);
    await supabase.from("portal_journey_events").delete().in("investor_id", ids);
    deleted["portal_journey_events"] = scope.candidates.journeyEvents;
    await supabase.from("portal_engagement").delete().in("investor_id", ids);
    deleted["portal_engagement"] = scope.candidates.engagement;
    await supabase.from("portal_leads").delete().in("id", ids);
    deleted["portal_leads"] = ids.length;
  }

  // Conversas fictícias soltas: mensagens de leads de teste que não
  // possuem mais cadastro (ex.: TEST-XXXX, ld_pt*).
  const { data: orphanRows } = await supabase.from("crm_messages").select("investor_id");
  const orphans = Array.from(
    new Set(
      ((orphanRows ?? []) as { investor_id: string }[])
        .map((m) => m.investor_id)
        .filter((id) => isFictitiousLead({ id })),
    ),
  );
  if (orphans.length > 0) {
    await supabase.from("crm_messages").delete().in("investor_id", orphans);
    await supabase.from("crm_timeline").delete().in("investor_id", orphans);
    deleted["crm_messages"] = (deleted["crm_messages"] ?? 0) + orphans.length;
  }

  for (const table of [
    "relationship_queue",
    "relationship_decisions",
    "relationship_events",
    "relationship_cadences",
    "relationship_engine_log",
  ]) {
    await supabase.from(table).delete().eq("scope", "homologation");
  }
  deleted["relationship_homologation"] = scope.candidates.homologationRows;

  const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);
  return { ...scope, executed: true, deleted, totalDeleted };
}