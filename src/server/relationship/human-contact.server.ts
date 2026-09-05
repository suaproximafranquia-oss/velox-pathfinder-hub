/**
 * CONTATO HUMANO REAL — LEITURA (BLOCO 1). SERVER ONLY.
 *
 * Consulta os registros que já existem e responde verdadeiro/falso.
 * NUNCA escreve: não cria evento, não altera lead, card ou fila, não
 * dispara E0 nem mensagem. É esta função que a futura regra de
 * redistribuição vai reutilizar — a definição não pode ser duplicada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  evaluateHumanContact,
  REAL_CONTACT_EVENT_TYPES,
  type ContactEvidence,
  type HumanContactVerdict,
} from "@/lib/relationship/human-contact";

export type HumanContactQuery = {
  /** Card operacional (`gs_...` / `ld_...`) usado pelo motor. */
  leadId: string;
  /** Identificador do lead na fila de ligações, quando conhecido. */
  crmLeadId?: string | null;
  /** Ambiente do motor; produção é o padrão. */
  scope?: "production" | "homologation";
};

/** Autoridade única: "este investidor já teve contato humano real?". */
export async function hasRealHumanContact(query: HumanContactQuery): Promise<HumanContactVerdict> {
  const scope = query.scope ?? "production";
  const evidences: ContactEvidence[] = [];

  const { data: events } = await supabaseAdmin
    .from("relationship_events")
    .select("type,occurred_at")
    .eq("scope", scope)
    .eq("lead_id", query.leadId)
    .in("type", [...REAL_CONTACT_EVENT_TYPES])
    .order("occurred_at", { ascending: true })
    .limit(50);

  for (const row of events ?? []) {
    evidences.push({ eventType: row.type, at: row.occurred_at });
  }

  /**
   * Confirmação manual: a Ação do Dia grava o resultado na própria fila
   * (`enviado_manual`) além do evento acima. Resultados de bloqueio,
   * falha ou simulação nunca entram — o filtro é da função de domínio.
   */
  const { data: executed } = await supabaseAdmin
    .from("relationship_queue")
    .select("result,executed_at")
    .eq("scope", scope)
    .eq("lead_id", query.leadId)
    .eq("status", "EXECUTED")
    .limit(50);

  for (const row of executed ?? []) {
    if (!row.result) continue;
    evidences.push({ eventType: "MESSAGE_SENT", result: row.result, at: row.executed_at });
  }

  /** Ligação: só a tentativa concluída com desfecho ATENDEU conta. */
  const callLeadId = query.crmLeadId ?? null;
  if (callLeadId) {
    const { data: calls } = await supabaseAdmin
      .from("crm_cadence_tasks")
      .select("status,outcome,completed_at")
      .eq("lead_id", callLeadId)
      .eq("channel", "call")
      .eq("status", "DONE")
      .limit(50);

    for (const row of calls ?? []) {
      evidences.push({
        callCompleted: true,
        callOutcome: row.outcome,
        at: row.completed_at,
      });
    }
  }

  return evaluateHumanContact(evidences);
}
