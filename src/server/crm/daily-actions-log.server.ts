/**
 * HISTÓRICO OPERACIONAL DA AÇÃO DO DIA — SERVER ONLY.
 *
 * A Ação do Dia continua sendo um AGREGADOR: ela não cria obrigação,
 * não move cadência e não é uma segunda fila. Este módulo apenas
 * REGISTRA o que o Executivo fez na tela (pular com justificativa,
 * observação, mensagem executada, desfecho de reunião) usando as
 * estruturas oficiais que já existem:
 *
 *   • `relationship_engine_log` → registro auditável com `details` jsonb
 *     (autor, ação, etapa, justificativa, data operacional);
 *   • `crm_timeline`            → leitura humana na ficha do investidor;
 *   • `portal_meetings`         → a reunião é resolvida na SUA origem.
 *
 * Nenhuma tabela nova é criada e nenhum envio real é liberado: nada
 * aqui fala com a Meta/WhatsApp.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { operationalDate } from "@/lib/crm/daily-actions";

/** Ações registradas por esta tela. Vocabulário fechado. */
export const DAILY_ACTION_EVENTS = {
  skip: "acao_do_dia_pulada",
  note: "acao_do_dia_observacao",
  message: "acao_do_dia_mensagem_registrada",
  meeting: "acao_do_dia_reuniao_resolvida",
  reschedule: "acao_do_dia_reuniao_reagendada",
} as const;

export type DailyActionLogInput = {
  actionKey: string;
  leadId: string | null;
  kind: string;
  step: string | null;
  title: string;
  /** Justificativa (obrigatória ao pular) ou observação livre. */
  reason: string;
  userId: string;
  executiveId: string | null;
  /** Resultado operacional, quando existir (compareceu, enviada…). */
  outcome?: string | null;
  nowIso?: string;
};

async function writeLedger(
  event: string,
  input: DailyActionLogInput,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  await supabaseAdmin.from("relationship_engine_log").insert({
    scope: "production",
    action: event,
    actor: input.executiveId ?? input.userId,
    details: {
      actionKey: input.actionKey,
      leadId: input.leadId,
      kind: input.kind,
      step: input.step,
      title: input.title,
      motivo: input.reason,
      resultado: input.outcome ?? null,
      executadoPor: input.userId,
      executivo: input.executiveId,
      operationalDate: operationalDate(nowIso),
      at: nowIso,
      ...extra,
    } as never,
  } as never);

  // Leitura humana na ficha — só existe quando há investidor.
  if (!input.leadId) return;
  await supabaseAdmin.from("crm_timeline").insert({
    id: crypto.randomUUID(),
    investor_id: input.leadId,
    event,
    origin: "acao_do_dia",
    reason: input.reason,
    actor_id: input.executiveId ?? input.userId,
    at: nowIso,
  } as never);
}

/** PULAR — justificativa é obrigatória e a ação nunca some sem histórico. */
export async function skipDailyAction(input: DailyActionLogInput): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new Error("Justificativa obrigatória para pular uma ação do dia.");
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  await writeLedger(DAILY_ACTION_EVENTS.skip, { ...input, reason, nowIso });
  await recordDailyActionHistory({
    leadId: input.leadId,
    sourceKey: `acao_do_dia:${input.actionKey}:pulada`,
    headline: historyHeadline("Ação pulada", input.step, nowIso),
    sections: [{ label: "Motivo", value: reason }],
    userId: input.userId,
    executiveId: input.executiveId,
  });
}

/** OBSERVAÇÃO operacional vinculada à ação e ao investidor. */
export async function noteDailyAction(input: DailyActionLogInput): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Escreva a observação antes de salvar.");
  const nowIso = input.nowIso ?? new Date().toISOString();
  await writeLedger(DAILY_ACTION_EVENTS.note, { ...input, reason, nowIso });
  await recordDailyActionHistory({
    leadId: input.leadId,
    // Cada observação é um acontecimento próprio: a chave carrega o
    // instante, então o Executivo pode registrar mais de uma.
    sourceKey: `acao_do_dia:${input.actionKey}:observacao:${nowIso}`,
    headline: historyHeadline("Observação do Executivo", input.step, nowIso),
    sections: [{ label: "Observação", value: reason }],
    userId: input.userId,
    executiveId: input.executiveId,
  });
}

/**
 * MENSAGEM EXECUTADA PELA INTERFACE. Registro de histórico apenas — a
 * mensagem não é enviada por aqui e a trava global permanece intacta.
 */
export async function registerDailyActionMessage(
  input: DailyActionLogInput,
): Promise<{ concluded: boolean; reason: string | null }> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const queueItemId = queueItemIdFromActionKey(input.actionKey);
  const outcome = await concludeQueueStep({
    leadId: input.leadId,
    step: input.step,
    queueItemId,
  });

  /**
   * SNAPSHOT HISTÓRICO DA EXECUÇÃO. Só quando a tarefa REAL da fila foi
   * concluída agora: uma confirmação repetida devolve `concluded: false`
   * e não chega aqui. O snapshot é imutável — editar a Biblioteca depois
   * não reescreve esta linha.
   */
  let snapshot: ManualMessageSnapshot | null = null;
  if (outcome.concluded) {
    snapshot = await recordManualMessageSnapshot({
      leadId: input.leadId!,
      step: input.step!,
      queueItemId: queueItemId!,
      actorId: input.executiveId ?? input.userId,
      nowIso,
    });
  }

  /**
   * OBSERVAÇÃO OPERACIONAL → NOTAS DO EXECUTIVO. Só quando a ação foi
   * REALMENTE concluída agora e há texto: copiar, abrir a ficha ou
   * pular nunca criam nota. A chave de origem é o item da fila, então
   * repetir a conclusão não duplica. Falha aqui nunca desfaz a
   * conclusão, o snapshot ou o avanço da cadência.
   */
  if (outcome.concluded && input.leadId && input.reason.trim().length > 0) {
    try {
      const { addInvestorNote } = await import("@/server/crm/investor-notes.server");
      await addInvestorNote({
        leadId: input.leadId,
        body: input.reason.trim(),
        userId: input.userId,
        executiveId: input.executiveId,
        sourceKey: `acao_do_dia:${queueItemId ?? input.actionKey}`,
      });
    } catch {
      // Nota é histórico complementar: nunca invalida a execução.
    }
  }

  /**
   * CONTEÚDO EXECUTADO → NOTAS DO EXECUTIVO. Reaproveita EXCLUSIVAMENTE
   * o snapshot já congelado nesta execução (`relationship_message_sends`):
   * nenhuma nova consulta à Biblioteca e nenhum segundo snapshot.
   */
  if (outcome.concluded && snapshot) {
    await recordDailyActionHistory({
      leadId: input.leadId,
      sourceKey: `acao_do_dia:${queueItemId ?? input.actionKey}:mensagem`,
      headline: historyHeadline("Mensagem enviada", input.step, nowIso),
      sections: [
        { label: "Biblioteca", value: snapshot.libraryCode },
        { label: "Versão", value: snapshot.libraryVersion?.toString() ?? null },
        { label: "Conteúdo", value: snapshot.contentUrl },
        { label: "Mensagem", value: snapshot.renderedBody },
      ],
      userId: input.userId,
      executiveId: input.executiveId,
    });
  }

  await writeLedger(
    DAILY_ACTION_EVENTS.message,
    {
      ...input,
      nowIso,
      reason: input.reason.trim() || "Mensagem tratada pelo Executivo na Ação do Dia.",
      outcome: input.outcome ?? (outcome.concluded ? "enviada" : "registrada"),
    },
    { queueItemId, motorResultado: outcome.reason },
  );

  return outcome;
}


/**
 * CONGELA O CONTEÚDO EFETIVAMENTE UTILIZADO em
 * `relationship_message_sends`, reutilizando exatamente as funções que
 * já montam o texto exibido na tela (`prepareStepMessage`) e que já
 * gravam o snapshot nos demais caminhos (`recordMessageSnapshot`).
 *
 * IDEMPOTÊNCIA: `message_id` é derivado do item ORIGINAL da fila e a
 * tabela tem índice único sobre ele — dois registros para a mesma
 * execução são impossíveis. Nenhum envio real acontece aqui.
 */
async function recordManualMessageSnapshot(params: {
  leadId: string;
  step: string;
  queueItemId: string;
  actorId: string;
  nowIso: string;
}): Promise<void> {
  try {
    const [{ prepareStepMessage }, { recordMessageSnapshot }, { isSimulatedExecution }] =
      await Promise.all([
        import("@/server/relationship/step-message.server"),
        import("@/server/relationship/message-library.server"),
        import("@/server/relationship/execution-mode.server"),
      ]);

    const prepared = await prepareStepMessage({
      leadId: params.leadId,
      step: params.step,
    });
    // Sem texto oficial não há o que congelar: o motivo já ficou no ledger.
    if (!prepared.body) return;

    const { data: cadence } = await supabaseAdmin
      .from("relationship_cadences")
      .select("id")
      .eq("lead_id", params.leadId)
      .eq("scope", "production")
      .maybeSingle();

    await recordMessageSnapshot({
      leadId: params.leadId,
      step: params.step,
      renderedBody: prepared.body,
      templateBody: prepared.templateBody ?? prepared.body,
      libraryId: prepared.libraryId,
      libraryVersion: prepared.libraryVersion,
      libraryCode: prepared.libraryCode,
      investorNameUsed: prepared.investorNameUsed,
      actorId: params.actorId,
      actorName: prepared.executiveName,
      origin: "executivo",
      cadenceId: (cadence as { id?: string } | null)?.id ?? null,
      messageId: `acao_do_dia:${params.queueItemId}`,
      contentUrl: prepared.contentUrl,
      channel: "whatsapp",
      simulated: isSimulatedExecution(),
      sentAt: params.nowIso,
    });
  } catch {
    // O snapshot é histórico: sua falha nunca desfaz a conclusão da etapa.
  }
}


/**
 * A chave da ação já carrega a tarefa REAL da fila:
 * `queue:<lead>:<fluxo>-<etapa>:<id>`. Nada é inventado aqui.
 */
function queueItemIdFromActionKey(actionKey: string): string | null {
  if (!actionKey.startsWith("queue:")) return null;
  const id = actionKey.split(":").pop() ?? "";
  return id.length > 0 ? id : null;
}

/**
 * CONCLUSÃO DA ETAPA NO MOTOR EXISTENTE. A mesma tarefa de
 * `relationship_queue` é encerrada (EXECUTED, `executed_at`, resultado)
 * e o avanço continua sendo calculado pelo motor. Idempotente: repetir
 * a confirmação não duplica histórico nem agendamento.
 */
async function concludeQueueStep(params: {
  leadId: string | null;
  step: string | null;
  queueItemId: string | null;
}): Promise<{ concluded: boolean; reason: string | null }> {
  if (!params.leadId || !params.step || !params.queueItemId) {
    return { concluded: false, reason: null };
  }
  const { productionEngine } = await import("@/server/relationship/engine.server");
  const { isKnownStep } = await import("@/lib/relationship/step-registry");
  const { ensureKnownSteps } = await import("@/server/relationship/step-registry.server");
  await ensureKnownSteps();
  if (!isKnownStep(params.step)) return { concluded: false, reason: null };
  const decision = await productionEngine().confirmManualExecution({
    leadId: params.leadId,
    step: params.step as never,
    queueItemId: params.queueItemId,
  });
  return { concluded: decision.outcome === "sent", reason: decision.reason ?? null };
}

/**
 * AÇÕES PULADAS HOJE. A supressão vale apenas para a data operacional
 * corrente: nada é apagado e a obrigação volta a aparecer amanhã se a
 * fonte oficial continuar pendente.
 */
export async function listSkippedActionKeys(nowIso: string): Promise<Set<string>> {
  const today = operationalDate(nowIso);
  const since = new Date(new Date(nowIso).getTime() - 3 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("relationship_engine_log")
    .select("details,created_at")
    .eq("action", DAILY_ACTION_EVENTS.skip)
    .gte("created_at", since)
    .limit(2000);
  const keys = new Set<string>();
  for (const row of data ?? []) {
    const details = (row as { details?: Record<string, unknown> }).details ?? {};
    if (details["operationalDate"] !== today) continue;
    const key = details["actionKey"];
    if (typeof key === "string") keys.add(key);
  }
  return keys;
}

/**
 * RESULTADO DA REUNIÃO — resolvido na fonte oficial (`portal_meetings`).
 * Nenhuma máquina de estados nova: apenas os status já permitidos pela
 * própria tabela.
 */
export async function resolveMeetingOutcome(input: {
  meetingId: string;
  attended: boolean;
  note: string;
  userId: string;
  executiveId: string | null;
  leadId: string | null;
  actionKey: string;
  title: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.attended ? "Concluída" : "Cancelada",
    updated_at: nowIso,
  };
  if (!input.attended) {
    patch["cancel_reason"] = input.note.trim() || "Investidor não compareceu.";
  }
  const { error } = await supabaseAdmin
    .from("portal_meetings")
    .update(patch as never)
    .eq("id", input.meetingId);
  if (error) throw new Error(error.message);

  await writeLedger(
    DAILY_ACTION_EVENTS.meeting,
    {
      actionKey: input.actionKey,
      leadId: input.leadId,
      kind: "reuniao",
      step: null,
      title: input.title,
      reason:
        input.note.trim() ||
        (input.attended ? "Investidor compareceu à reunião." : "Investidor não compareceu."),
      userId: input.userId,
      executiveId: input.executiveId,
      outcome: input.attended ? "compareceu" : "nao_compareceu",
      nowIso,
    },
    { meetingId: input.meetingId },
  );
}

/** REAGENDAMENTO — mesma reunião, nova data, na fonte oficial. */
export async function rescheduleMeeting(input: {
  meetingId: string;
  scheduledAt: string;
  note: string;
  userId: string;
  executiveId: string | null;
  leadId: string | null;
  actionKey: string;
  title: string;
}): Promise<void> {
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Nova data inválida.");
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("portal_meetings")
    .update({
      scheduled_at: when.toISOString(),
      status: "Reagendada",
      updated_at: nowIso,
    } as never)
    .eq("id", input.meetingId);
  if (error) throw new Error(error.message);

  await writeLedger(
    DAILY_ACTION_EVENTS.reschedule,
    {
      actionKey: input.actionKey,
      leadId: input.leadId,
      kind: "reuniao",
      step: null,
      title: input.title,
      reason: input.note.trim() || "Reunião reagendada pelo Executivo.",
      userId: input.userId,
      executiveId: input.executiveId,
      outcome: "reagendada",
      nowIso,
    },
    { meetingId: input.meetingId, novaData: when.toISOString() },
  );
}
