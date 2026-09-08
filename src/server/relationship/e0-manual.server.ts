/**
 * E0 MANUAL — ENTRADA NA RÉGUA V2 (Financeira /f) — SERVER ONLY.
 *
 * Quando o executivo responsável está em MODO MANUAL (`e0_automatico`
 * desligado), a E0 NÃO é disparada pelo sistema. Ela é uma etapa REAL
 * da régua V2, cobrada pela Ação do Dia na sequência:
 *
 *   ligação 1 → 10 minutos → ligação 2 → mensagem E0 para COPIAR
 *
 * Este módulo só faz uma coisa: abrir a cadência V2 em E0 para os cards
 * manuais que ainda não têm ciclo, através do MESMO motor e da MESMA
 * fila (`relationship_queue`). Nenhum envio, nenhuma `crm_messages`,
 * nenhum caminho paralelo. A ação legada (`workspace_e0_actions`) é
 * preservada apenas como histórico/compatibilidade — quem governa é a régua.
 *
 * IDEMPOTÊNCIA: o evento de abertura tem chave estável
 * (`e0_manual_open_<card>`); repetir a chamada não abre segundo ciclo.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PendingRow = {
  card_id: string;
  state: string;
  ownership_seq: number | null;
  voided_at: string | null;
  responsible_executive_id: string | null;
};

export function manualE0EventKey(cardId: string, ownershipSeq = 0): string {
  return ownershipSeq > 0 ? `e0_manual_open_${cardId}__own${ownershipSeq}` : `e0_manual_open_${cardId}`;
}

/** Cards cuja E0 já é governada pela régua V2 (evento de abertura registrado). */
export async function governedByV2(cardIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(cardIds.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const { data } = await supabaseAdmin
    .from("relationship_events")
    .select("lead_id,event_key")
    .eq("scope", "production")
    .in("lead_id", unique)
    .like("event_key", "e0_manual_open_%");
  const governed = new Set<string>();
  for (const row of (data ?? []) as { lead_id: string; event_key: string | null }[]) {
    // Só a abertura da PRIMEIRA titularidade governa o card legado de seq 0.
    if (row.event_key === manualE0EventKey(row.lead_id)) governed.add(row.lead_id);
  }
  return governed;
}

/**
 * Abre a E0 manual na régua V2 para UM card. Retorna true quando o card
 * fica governado pela régua (aberto agora ou já aberto antes).
 */
export async function openManualE0Cadence(cardId: string, ownershipSeq = 0): Promise<boolean> {
  if (!cardId) return false;
  // Redistribuição real (seq > 0) fica no caminho legado por ora: um
  // ciclo já existente não pode ser reiniciado por aqui.
  if (ownershipSeq > 0) return false;

  const already = await governedByV2([cardId]);
  if (already.has(cardId)) return true;

  // Ciclo já existente e ATIVO (não apenas registrado) → não é E0 manual nova.
  const { data: cadence } = await supabaseAdmin
    .from("relationship_cadences")
    .select("state")
    .eq("scope", "production")
    .eq("lead_id", cardId)
    .eq("active", true)
    .order("instance_seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  const state = (cadence as { state?: string } | null)?.state ?? null;
  if (state && state !== "CADENCE_NOT_STARTED") return false;

  // Primeiro contato REAL já registrado (não anulado) → E0 não se repete.
  const { data: msg } = await supabaseAdmin
    .from("crm_messages")
    .select("id")
    .eq("investor_id", cardId)
    .like("id", "msg_e0_%")
    .is("voided_at", null)
    .limit(1);
  if ((msg ?? []).length > 0) return false;

  const { productionEngine } = await import("./engine.server");
  await productionEngine().handleEvent({
    id: manualE0EventKey(cardId, ownershipSeq),
    leadId: cardId,
    type: "LEAD_CREATED",
    at: new Date().toISOString(),
    data: { manualE0: true, origin: "acao_do_dia" },
  });
  return true;
}

/**
 * Reconciliação idempotente: toda pendência manual de E0 (e a E0 cujo
 * teste legado foi ANULADO) passa a viver na régua V2. Devolve o
 * conjunto de cards governados pela régua.
 */
export async function ensureManualE0Cadences(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("workspace_e0_actions")
    .select("card_id,state,ownership_seq,voided_at,responsible_executive_id")
    .or("and(state.eq.PENDENTE,voided_at.is.null),and(state.eq.EXECUTADA,voided_at.not.is.null)")
    .order("created_at", { ascending: true })
    .limit(500);
  const rows = (data ?? []) as PendingRow[];
  if (rows.length === 0) return new Set();

  const governed = await governedByV2(rows.map((r) => r.card_id));
  for (const row of rows) {
    if (governed.has(row.card_id)) continue;
    try {
      const ok = await openManualE0Cadence(row.card_id, row.ownership_seq ?? 0);
      if (ok) governed.add(row.card_id);
    } catch {
      // Um card com problema não impede os demais; ele volta no próximo ciclo.
    }
  }
  return governed;
}
