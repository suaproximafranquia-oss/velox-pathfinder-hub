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
  await writeLedger(DAILY_ACTION_EVENTS.skip, { ...input, reason });
}

/** OBSERVAÇÃO operacional vinculada à ação e ao investidor. */
export async function noteDailyAction(input: DailyActionLogInput): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Escreva a observação antes de salvar.");
  await writeLedger(DAILY_ACTION_EVENTS.note, { ...input, reason });
}

/**
 * MENSAGEM EXECUTADA PELA INTERFACE. Registro de histórico apenas — a
 * mensagem não é enviada por aqui e a trava global permanece intacta.
 */
export async function registerDailyActionMessage(
  input: DailyActionLogInput,
): Promise<{ concluded: boolean; reason: string | null }> {
  const queueItemId = queueItemIdFromActionKey(input.actionKey);
  const outcome = await concludeQueueStep({
    leadId: input.leadId,
    step: input.step,
    queueItemId,
  });

  await writeLedger(
    DAILY_ACTION_EVENTS.message,
    {
      ...input,
      reason: input.reason.trim() || "Mensagem tratada pelo Executivo na Ação do Dia.",
      outcome: input.outcome ?? (outcome.concluded ? "enviada" : "registrada"),
    },
    { queueItemId, motorResultado: outcome.reason },
  );

  return outcome;
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
  const decision = await productionEngine().confirmManualExecution({
    leadId: params.leadId,
    step: params.step,
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
