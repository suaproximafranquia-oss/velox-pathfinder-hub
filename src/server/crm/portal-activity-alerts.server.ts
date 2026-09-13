/**
 * ALERTA DE ATIVIDADE DO PORTAL — SOMENTE LEITURA DE FONTES EXISTENTES.
 *
 * Não é etapa de cadência, não é ligação, não é mensagem e não envia
 * nada ao investidor. É apenas um SINAL COMERCIAL para o Executivo:
 * "este investidor acessou o Portal".
 *
 * Fontes oficiais reutilizadas (nenhuma tabela nova é criada):
 *   • `portal_leads`            → carteira vigente do Executivo;
 *   • `portal_journey_events`   → eventos REAIS do investidor no Portal;
 *   • `relationship_engine_log` → registro de que o alerta foi concluído.
 *
 * REGRAS:
 *   • o PRIMEIRO acesso real gera um alerta;
 *   • um novo alerta só nasce depois de 7 dias completos sem nenhum
 *     acesso real — quantas vezes o investidor voltar;
 *   • eventos administrativos, de identidade, de formulário comercial e
 *     de página não geram alerta;
 *   • acessos da mesma visita nunca geram um segundo alerta;
 *   • "Concluído" apenas encerra o alerta — nada na cadência muda.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Eventos que representam ATIVIDADE REAL do investidor no conteúdo. */
const REAL_EVENTS = [
  "module.opened",
  "journey.module.opened",
  "manual.started",
  "manual.chapter.completed",
  "manual.completed",
  "simulator.started",
  "simulator.completed",
];

/** Nova visita relevante: 7 dias completos sem nenhum acesso real. */
const RETURN_GAP_MS = 7 * 24 * 3600 * 1000;

export const PORTAL_ALERT_DONE_ACTION = "acao_do_dia_alerta_portal_concluido";

export type PortalActivityAlert = {
  actionKey: string;
  leadId: string;
  /** Instante do acesso que originou o alerta. */
  at: string;
  /** Conteúdo acessado, quando o evento fornece um módulo reconhecido. */
  contentLabel: string | null;
};

function alertKey(leadId: string, at: string): string {
  return `portal_alert:${leadId}:${at}`;
}

/** Alertas já concluídos pelo Executivo — nunca voltam após recarregar. */
async function loadConcluded(): Promise<Set<string>> {
  const done = new Set<string>();
  try {
    const { data } = await supabaseAdmin
      .from("relationship_engine_log")
      .select("details")
      .eq("action", PORTAL_ALERT_DONE_ACTION)
      .limit(4000);
    for (const row of (data ?? []) as Array<{ details?: Record<string, unknown> | null }>) {
      const key = (row.details ?? {})["actionKey"];
      if (typeof key === "string") done.add(key);
    }
  } catch {
    /* leitura de histórico nunca derruba a lista do dia */
  }
  return done;
}

export async function listPortalActivityAlerts(
  executiveId: string | null,
  nowIso: string,
): Promise<PortalActivityAlert[]> {
  if (!executiveId) return [];
  const now = Date.parse(nowIso);

  const { data: leadRows } = await supabaseAdmin
    .from("portal_leads")
    .select("id,is_test,archived_at")
    .eq("responsible_executive_id", executiveId)
    .limit(1000);

  const leadIds = ((leadRows ?? []) as Array<{
    id: string;
    is_test?: boolean | null;
    archived_at?: string | null;
  }>)
    .filter((l) => l.is_test !== true && !l.archived_at)
    .map((l) => l.id);
  if (leadIds.length === 0) return [];

  const { data: eventRows } = await supabaseAdmin
    .from("portal_journey_events")
    .select("investor_id,event,module,created_at")
    .in("investor_id", leadIds)
    .in("event", REAL_EVENTS)
    .order("created_at", { ascending: true })
    .limit(5000);

  const byLead = new Map<string, Array<{ at: string; module: string | null }>>();
  for (const row of (eventRows ?? []) as Array<{
    investor_id: string;
    created_at: string;
    module?: string | null;
  }>) {
    const list = byLead.get(row.investor_id) ?? [];
    list.push({ at: row.created_at, module: row.module ?? null });
    byLead.set(row.investor_id, list);
  }

  const concluded = await loadConcluded();
  const alerts: PortalActivityAlert[] = [];

  const { canonicalModule, CANONICAL_MODULE_LABEL } = await import("@/lib/portal-module-keys");
  for (const [leadId, moments] of byLead) {
    let previousQualified: number | null = null;
    for (const moment of moments) {
      const iso = moment.at;
      const at = Date.parse(iso);
      if (!Number.isFinite(at)) continue;
      const isNewVisit = previousQualified === null || at - previousQualified >= RETURN_GAP_MS;
      if (!isNewVisit) continue;
      previousQualified = at;
      const key = alertKey(leadId, iso);
      if (concluded.has(key)) continue;
      const module = canonicalModule(moment.module);
      alerts.push({
        actionKey: key,
        leadId,
        at: iso,
        contentLabel: module ? CANONICAL_MODULE_LABEL[module] : null,
      });
    }
  }

  return alerts.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/**
 * CONCLUIR O ALERTA — encerra apenas o sinal. Não conclui obrigação,
 * não move cadência, não toca na fila e não fala com o WhatsApp.
 */
export async function concludePortalActivityAlert(input: {
  actionKey: string;
  leadId: string | null;
  userId: string;
  executiveId: string | null;
}): Promise<void> {
  if (!input.leadId) throw new Error("Lead do alerta não identificado.");
  const prefix = `portal_alert:${input.leadId}:`;
  if (!input.actionKey.startsWith(prefix)) {
    throw new Error("Alerta inválido.");
  }
  const alertAt = input.actionKey.slice(prefix.length);
  if (!Number.isFinite(Date.parse(alertAt))) throw new Error("Instante do alerta inválido.");

  const { data: event } = await supabaseAdmin
    .from("portal_journey_events")
    .select("created_at")
    .eq("investor_id", input.leadId)
    .in("event", REAL_EVENTS)
    .eq("created_at", alertAt)
    .maybeSingle();
  if (!event) throw new Error("A atividade original do alerta não foi encontrada.");

  const { data: lead } = await supabaseAdmin
    .from("portal_leads")
    .select("viewed_at,responsible_executive_id")
    .eq("id", input.leadId)
    .maybeSingle();
  if (!lead || (input.executiveId && lead.responsible_executive_id !== input.executiveId)) {
    throw new Error("Alerta não pertence a este Executivo.");
  }
  const leadId = input.leadId;

  const { data: existing } = await supabaseAdmin
    .from("relationship_engine_log")
    .select("id")
    .eq("action", PORTAL_ALERT_DONE_ACTION)
    .contains("details", { actionKey: input.actionKey })
    .limit(1);
  const currentViewed = lead.viewed_at ? Date.parse(lead.viewed_at) : Number.NEGATIVE_INFINITY;
  let advancedViewedAt = false;
  if (Date.parse(alertAt) > currentViewed) {
    const { error: viewedError } = await supabaseAdmin
      .from("portal_leads")
      .update({ viewed_at: alertAt } as never)
      .eq("id", leadId);
    if (viewedError) throw new Error(viewedError.message);
    advancedViewedAt = true;
  }

  if ((existing ?? []).length === 0) {
    const { error: logError } = await supabaseAdmin.from("relationship_engine_log").insert({
      scope: "production",
      action: PORTAL_ALERT_DONE_ACTION,
      actor: input.executiveId ?? input.userId,
      details: {
        actionKey: input.actionKey,
        leadId,
        executadoPor: input.userId,
        executivo: input.executiveId,
        at: new Date().toISOString(),
      } as never,
    } as never);
    if (logError) {
      if (advancedViewedAt) {
        await supabaseAdmin
          .from("portal_leads")
          .update({ viewed_at: lead.viewed_at ?? null } as never)
          .eq("id", leadId)
          .eq("viewed_at", alertAt);
      }
      throw new Error(logError.message);
    }
  }
}
