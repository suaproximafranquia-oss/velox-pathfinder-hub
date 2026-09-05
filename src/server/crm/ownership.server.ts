/**
 * TITULARIDADE DO CARD + REDISTRIBUIÇÃO MANUAL DO GREENSALES (BLOCO 2).
 * SERVER ONLY.
 *
 * O lead continua sendo a MESMA entidade histórica: nenhum card é
 * duplicado, apagado ou consolidado. O que muda é o RESPONSÁVEL
 * OPERACIONAL ATUAL — e essa mudança é registrada em histórico
 * append-only (`lead_ownership_history`).
 *
 * Quando a mudança é real e ainda NÃO houve contato humano real
 * (autoridade única: `hasRealHumanContact`, do BLOCO 1), a
 * redistribuição inicia uma NOVA ENTRADA OPERACIONAL para o novo
 * responsável — com o modo de E0 do NOVO responsável (nunca do
 * anterior, nunca do cron, nunca do Administrador por padrão).
 *
 * NADA aqui envia mensagem por conta própria: a entrega continua
 * passando pelo mesmo caminho oficial e pela Global WhatsApp Safety
 * Lock, intocada. A etiqueta ZERO CONTATO não participa da decisão.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasRealHumanContact } from "@/server/relationship/human-contact.server";
import { resolveExecutiveE0Mode } from "@/server/crm/first-contact-mode.server";
import { createPendingE0Action } from "@/server/crm/e0-actions.server";
import { recordEvent } from "@/server/crm/lead-service.server";
import { executionMode } from "@/server/relationship/execution-mode.server";
import { readCardResponsible, type ResolvedResponsible } from "@/server/crm/responsible.server";

export type RedistributionOutcome = {
  /** Houve mudança REAL de responsável? */
  redistributed: boolean;
  previousExecutiveId: string | null;
  newExecutiveId: string | null;
  ownershipSeq: number;
  hadRealContact: boolean;
  /** Nova entrada operacional criada para o novo responsável? */
  newEntry: "manual" | "automatica" | "nenhuma";
  reason: string;
};

const NONE: RedistributionOutcome = {
  redistributed: false,
  previousExecutiveId: null,
  newExecutiveId: null,
  ownershipSeq: 0,
  hadRealContact: false,
  newEntry: "nenhuma",
  reason: "Sem mudança de responsável.",
};

/** Ciclo operacional ativo do card, quando já existir (somente leitura). */
async function activeCycleId(cardId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("relationship_cadences")
    .select("id")
    .eq("scope", "production")
    .eq("lead_id", cardId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/** Quantas trocas de titularidade este card já teve. */
async function ownershipCount(cardId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("lead_ownership_history")
    .select("id", { count: "exact", head: true })
    .eq("card_id", cardId);
  return count ?? 0;
}

/**
 * Detecta e aplica a redistribuição informada pela ORIGEM.
 *
 * Regra (§7): iguais ⇒ não é redistribuição; card inexistente ⇒ entrada
 * normal (tratada pelo intake, não aqui); diferentes ⇒ REDISTRIBUIÇÃO.
 */
export async function applyOriginResponsibleChange(input: {
  cardId: string;
  crmLeadId: string | null;
  canonicalInvestorId?: string | null;
  originResponsible: ResolvedResponsible;
  /** Identificador do evento de origem, quando existir. */
  sourceEventId?: string | null;
  leadName?: string | null;
  leadWhatsapp?: string | null;
  entryAt?: string | null;
  enteredEntryStageAt?: string | null;
  isTestLead?: boolean;
}): Promise<RedistributionOutcome> {
  if (!input.originResponsible?.executiveId) {
    return {
      ...NONE,
      reason:
        "Responsável da origem não resolvido (vendedor não mapeado) — nenhuma alteração de titularidade.",
    };
  }

  const card = await readCardResponsible(input.cardId);
  if (!card.exists) {
    return { ...NONE, reason: "Card ainda não existe — entrada normal de lead novo." };
  }

  const previous = card.executiveId;
  const next = input.originResponsible.executiveId;
  if (previous === next) {
    return { ...NONE, previousExecutiveId: previous, newExecutiveId: next };
  }

  /**
   * IDEMPOTÊNCIA (§13): investidor/card + responsável + ciclo de
   * titularidade. A repetição do MESMO evento A→B não cria segundo
   * registro nem segunda E0, porque a sequência só avança quando o
   * responsável ATUAL do card realmente muda.
   */
  const seq = (await ownershipCount(input.cardId)) + 1;
  const changeKey = `${input.cardId}|${previous ?? "-"}|${next}|${seq}`;
  const cycleId = await activeCycleId(input.cardId);

  const contact = await hasRealHumanContact({
    leadId: input.cardId,
    crmLeadId: input.crmLeadId,
  });

  const { error: historyError } = await supabaseAdmin.from("lead_ownership_history").insert({
    card_id: input.cardId,
    crm_lead_id: input.crmLeadId,
    canonical_investor_id: input.canonicalInvestorId ?? null,
    previous_executive_id: previous,
    new_executive_id: next,
    ownership_seq: seq,
    source: "greensales_sync",
    source_event_id: input.sourceEventId ?? null,
    cadence_cycle_id: cycleId,
    had_real_human_contact: contact.hasContact,
    triggered_new_entry: !contact.hasContact,
    reason: contact.reason,
    change_key: changeKey,
  } as never);
  if (historyError && historyError.code === "23505") {
    return {
      ...NONE,
      previousExecutiveId: previous,
      newExecutiveId: next,
      reason: "Mudança de titularidade já registrada — nada foi repetido.",
    };
  }
  if (historyError) {
    return {
      ...NONE,
      previousExecutiveId: previous,
      newExecutiveId: next,
      reason: `Histórico de titularidade não gravado: ${historyError.message}. Responsável preservado.`,
    };
  }

  /**
   * §14 — o card passa a refletir o responsável ATUAL. O responsável
   * anterior não é apagado: ele permanece no histórico acima e em todo
   * o registro operacional já existente (mensagens, timeline, E0).
   */
  await supabaseAdmin
    .from("portal_leads")
    .update({
      responsible_executive_id: next,
      responsible_executive_slug: input.originResponsible.slug ?? null,
    } as never)
    .eq("id", input.cardId);

  if (input.crmLeadId) {
    await recordEvent(
      input.crmLeadId,
      "titularidade_alterada",
      `Redistribuição informada pela origem: ${previous ?? "sem responsável"} → ${next}. ${contact.reason}`,
      { previous, next, ownershipSeq: seq, hadRealContact: contact.hasContact },
    );
  }

  /**
   * §10 — CONTATO HUMANO REAL DECIDE. Com relacionamento já iniciado o
   * novo responsável apenas ASSUME o lead: nenhuma nova E0 é gerada.
   */
  if (contact.hasContact) {
    return {
      redistributed: true,
      previousExecutiveId: previous,
      newExecutiveId: next,
      ownershipSeq: seq,
      hadRealContact: true,
      newEntry: "nenhuma",
      reason: `Relacionamento já existente preservado — ${contact.reason}`,
    };
  }

  /** §12 — o modo é sempre do NOVO responsável. */
  const mode = await resolveExecutiveE0Mode(next);
  const ownershipKey = `own${seq}`;

  if (mode.mode === "manual") {
    await createPendingE0Action({
      cardId: input.cardId,
      crmLeadId: input.crmLeadId,
      origin: "greensales",
      name: input.leadName ?? "",
      whatsapp: input.leadWhatsapp ?? "",
      responsibleExecutiveId: next,
      entryAt: input.entryAt ?? null,
      enteredEntryStageAt: input.enteredEntryStageAt ?? null,
      reactivation: false,
      ownershipSeq: seq,
      ownershipKey,
    });
    return {
      redistributed: true,
      previousExecutiveId: previous,
      newExecutiveId: next,
      ownershipSeq: seq,
      hadRealContact: false,
      newEntry: "manual",
      reason: `Nova primeira aproximação pendente na Ação do Dia. ${mode.reason}`,
    };
  }

  /**
   * Automático: MESMO caminho oficial de sempre (elegibilidade, janela
   * operacional, template, Safety Lock). Nada é contornado aqui.
   */
  const { registerFirstContact } = await import("@/server/crm/first-contact.server");
  const execution = executionMode({ isTestLead: Boolean(input.isTestLead) });
  const e0 = await registerFirstContact({
    leadId: input.cardId,
    name: input.leadName ?? "",
    phone: input.leadWhatsapp ?? "",
    origin: "GreenSales",
    entryOrigin: "GREENSALES",
    ownerId: null,
    entryAt: input.entryAt ?? null,
    enteredEntryStageAt: input.enteredEntryStageAt ?? null,
    reactivation: false,
    simulated: execution.simulated,
    cycleKey: ownershipKey,
  });

  return {
    redistributed: true,
    previousExecutiveId: previous,
    newExecutiveId: next,
    ownershipSeq: seq,
    hadRealContact: false,
    newEntry: e0.registered ? "automatica" : "nenhuma",
    reason: e0.registered
      ? `Nova primeira aproximação automática registrada para ${next}. ${mode.reason}`
      : `Primeira aproximação automática não executada: ${e0.reason}`,
  };
}
