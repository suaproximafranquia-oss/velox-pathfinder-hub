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
/** Um alerta só é trabalho de agora enquanto for recente. */
const VISIBLE_WINDOW_MS = 7 * 24 * 3600 * 1000;

export const PORTAL_ALERT_DONE_ACTION = "acao_do_dia_alerta_portal_concluido";

export type PortalActivityAlert = {
  actionKey: string;
  leadId: string;
  /** Instante do acesso que originou o alerta. */
  at: string;
};

function alertKey(leadId: string, at: string): string {
  return `portal_alert:${leadId}:${at}`;
}

/** Alertas já concluídos pelo Executivo — nunca voltam após recarregar. */
async function loadConcluded(): Promise<Set<string>> {
  const since = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
  const done = new Set<string>();
  try {
    const { data } = await supabaseAdmin
      .from("relationship_engine_log")
      .select("details")
      .eq("action", PORTAL_ALERT_DONE_ACTION)
      .gte("created_at", since)
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

  const since = new Date(now - 400 * 24 * 3600 * 1000).toISOString();
  const { data: eventRows } = await supabaseAdmin
    .from("portal_journey_events")
    .select("investor_id,event,created_at")
    .in("investor_id", leadIds)
    .in("event", REAL_EVENTS)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);

  const byLead = new Map<string, string[]>();
  for (const row of (eventRows ?? []) as Array<{ investor_id: string; created_at: string }>) {
    const list = byLead.get(row.investor_id) ?? [];
    list.push(row.created_at);
    byLead.set(row.investor_id, list);
  }

  const concluded = await loadConcluded();
  const alerts: PortalActivityAlert[] = [];

  for (const [leadId, moments] of byLead) {
    let previous: number | null = null;
    for (const iso of moments) {
      const at = Date.parse(iso);
      if (!Number.isFinite(at)) continue;
      const isNewVisit = previous === null || at - previous >= RETURN_GAP_MS;
      previous = at;
      if (!isNewVisit) continue;
      if (now - at > VISIBLE_WINDOW_MS) continue;
      const key = alertKey(leadId, iso);
      if (concluded.has(key)) continue;
      alerts.push({ actionKey: key, leadId, at: iso });
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
  if (!input.actionKey.startsWith("portal_alert:")) {
    throw new Error("Alerta inválido.");
  }
  await supabaseAdmin.from("relationship_engine_log").insert({
    scope: "production",
    action: PORTAL_ALERT_DONE_ACTION,
    actor: input.executiveId ?? input.userId,
    details: {
      actionKey: input.actionKey,
      leadId: input.leadId,
      executadoPor: input.userId,
      executivo: input.executiveId,
      at: new Date().toISOString(),
    } as never,
  } as never);
}
