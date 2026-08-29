/**
 * EXECUTOR DO MOTOR DE RELACIONAMENTO — SERVER ONLY.
 *
 * Diagnóstico da homologação: a E0 acontecia, mas NENHUM processo
 * reavaliava o lead depois disso. O motor existia, decidia e sabia
 * calcular a próxima etapa — só que ninguém o chamava em produção. Este
 * arquivo é exatamente esse elo que faltava.
 *
 * Princípios:
 *   • recalcula a partir do estado real — tarefa vencida NÃO desaparece,
 *     ela continua pendente até a próxima janela válida;
 *   • idempotente: a decisão de cada etapa é do próprio motor, que já
 *     recusa repetição, execução fora de ordem e agendamento duplicado;
 *   • um lead com erro nunca interrompe os demais;
 *   • motor desligado (`RELATIONSHIP_CONFIG.enabled = false`) continua
 *     desligado: o executor roda, registra a decisão e não envia nada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { productionEngine } from "./engine.server";

export type RelationshipTickSummary = {
  evaluated: number;
  scheduled: number;
  sent: number;
  blocked: number;
  noop: number;
  errors: string[];
};

/** Quantos leads são reavaliados por execução (protege o tempo do cron). */
const BATCH = 200;

/**
 * Leads que o motor precisa reavaliar agora:
 *   1. quem já tem cadência aberta em produção;
 *   2. quem tem tarefa PENDENTE vencida (recuperação de atraso);
 *   3. quem já recebeu a E0 e ainda não tem cadência registrada.
 */
async function eligibleLeadIds(nowIso: string): Promise<string[]> {
  const ids = new Set<string>();

  const { data: open } = await supabaseAdmin
    .from("relationship_cadences")
    .select("lead_id,state")
    .eq("scope", "production")
    .is("run_id", null)
    .not("state", "in", "(COMPLETED,CLOSED,INTERRUPTED)")
    .limit(BATCH);
  for (const row of open ?? []) ids.add(row.lead_id);

  const { data: due } = await supabaseAdmin
    .from("relationship_queue")
    .select("lead_id")
    .eq("scope", "production")
    .in("status", ["PENDING", "PROCESSING"])
    .lte("due_at", nowIso)
    .limit(BATCH);
  for (const row of due ?? []) ids.add(row.lead_id);

  // Quem recebeu a E0 (mensagem `msg_e0_<cardId>`) e ainda não aparece
  // acima simplesmente nunca entrou no motor — é o caso observado.
  const { data: firstContacts } = await supabaseAdmin
    .from("crm_messages")
    .select("investor_id,at")
    .like("id", "msg_e0_%")
    .order("at", { ascending: false })
    .limit(BATCH);
  for (const row of firstContacts ?? []) ids.add(row.investor_id);

  return Array.from(ids).slice(0, BATCH);
}

/**
 * RESGATE DA E0 (falha observada em produção): existem leads cuja E0 foi
 * enviada e registrada em `crm_messages`, mas que nunca chegaram a
 * existir para o motor — sem cadência, todo ciclo apenas repetia
 * "cadência não iniciada" e nenhuma etapa avançava.
 *
 * Aqui a E0 já ocorrida é registrada no motor com a MESMA chave de
 * evento usada no envio (`e0_<lead>`): se já existir, nada acontece;
 * nenhuma mensagem é reenviada, apenas o estado passa a existir.
 */
async function bootstrapMissingCadences(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const engine = productionEngine();

  const { data: existing } = await supabaseAdmin
    .from("relationship_cadences")
    .select("lead_id")
    .eq("scope", "production")
    .is("run_id", null)
    .in("lead_id", leadIds);
  const known = new Set((existing ?? []).map((row) => row.lead_id));

  const missing = leadIds.filter((id) => !known.has(id));
  if (missing.length === 0) return 0;

  const { data: firstContacts } = await supabaseAdmin
    .from("crm_messages")
    .select("investor_id,at")
    .in("investor_id", missing)
    .like("id", "msg_e0_%");

  let recovered = 0;
  for (const row of firstContacts ?? []) {
    try {
      await engine.handleEvent({
        id: `e0_${row.investor_id}`,
        scope: "production",
        leadId: row.investor_id,
        type: "FIRST_CONTACT_SENT",
        at: row.at,
        step: "E0",
      });
      recovered += 1;
    } catch {
      /* um lead com problema nunca interrompe os demais */
    }
  }
  return recovered;
}

export async function runRelationshipTick(): Promise<RelationshipTickSummary> {
  const summary: RelationshipTickSummary = {
    evaluated: 0,
    scheduled: 0,
    sent: 0,
    blocked: 0,
    noop: 0,
    errors: [],
  };
  const engine = productionEngine();
  const startedAt = new Date().toISOString();
  const leadIds = await eligibleLeadIds(startedAt);
  const recovered = await bootstrapMissingCadences(leadIds);


  for (const leadId of leadIds) {
    try {
      const decision = await engine.tick(leadId);
      summary.evaluated += 1;
      if (decision.outcome === "scheduled") summary.scheduled += 1;
      else if (decision.outcome === "sent") summary.sent += 1;
      else if (decision.outcome === "blocked") summary.blocked += 1;
      else summary.noop += 1;
    } catch (error) {
      if (summary.errors.length < 20) {
        summary.errors.push(
          `Lead ${leadId}: ${error instanceof Error ? error.message : "falha desconhecida"}`,
        );
      }
    }
  }

  /**
   * FECHAMENTO DO CICLO (E27 e FINALIZAÇÃO). As duas datas já eram
   * gravadas pela E20; agora o mesmo tick que roda a cadência também
   * executa o fechamento vencido. Falha aqui não invalida a cadência.
   */
  let closed = 0;
  try {
    const { runClosureTick } = await import("./closure.server");
    const outcomes = await runClosureTick(startedAt);
    closed = outcomes.filter((o) => o.executed).length;
  } catch (error) {
    if (summary.errors.length < 20) {
      summary.errors.push(
        `Fechamento: ${error instanceof Error ? error.message : "falha desconhecida"}`,
      );
    }
  }

  /**
   * OBSERVABILIDADE DO CICLO: cada execução do executor deixa rastro
   * próprio. Sem isso é impossível responder "o motor rodou e não fez
   * nada" x "o motor não rodou". Falha de log nunca invalida o ciclo.
   */
  try {
    await supabaseAdmin.from("relationship_engine_log").insert({
      scope: "production",
      action: "ciclo_motor",
      details: {
        startedAt,
        finishedAt: new Date().toISOString(),
        cadenciasResgatadas: recovered,
        fechamentosExecutados: closed,
        ...summary,
      } as any,
    } as any);

  } catch {
    /* registro do ciclo é auxiliar */
  }
  return summary;
}

