/**
 * Auditoria da blindagem dos Leads — SERVER ONLY.
 *
 * Toda tentativa bloqueada de exclusão/reset de Lead é registrada em
 * `portal_lead_guard_log` com usuário, data/hora, operação e motivo.
 * O gatilho `guard_lead_delete` no banco é a última linha de defesa e
 * registra as tentativas que chegarem por qualquer outro caminho
 * (API, scripts, serviços). Este módulo cobre as tentativas barradas
 * antes de chegar ao banco, com a identidade do usuário autenticado.
 *
 * A auditoria nunca pode quebrar o fluxo principal: falha ao registrar
 * não libera a operação — o bloqueio acontece de qualquer forma.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BlockedLeadOperation = {
  tableName: "portal_leads" | "crm_leads";
  leadId: string | null;
  leadName?: string | null;
  /** delete = exclusão; reset = reset/limpeza; truncate = esvaziamento. */
  operation: "delete" | "reset" | "truncate";
  actorUserId?: string | null;
  actorLabel?: string | null;
  reason: string;
};

export async function logBlockedLeadOperation(entry: BlockedLeadOperation): Promise<void> {
  try {
    // A tabela foi criada pela migração de blindagem; o cast preserva o
    // typecheck independentemente da regeneração dos tipos.
    await (supabaseAdmin.from("portal_lead_guard_log" as never) as unknown as {
      insert: (row: Record<string, unknown>) => Promise<unknown>;
    }).insert({
      table_name: entry.tableName,
      lead_id: entry.leadId,
      lead_name: entry.leadName ?? null,
      operation: entry.operation,
      actor_user_id: entry.actorUserId ?? null,
      actor_label: entry.actorLabel ?? null,
      reason: entry.reason,
    });
  } catch {
    /* auditoria nunca interrompe o bloqueio */
  }
}
