/**
 * Fila de execução comercial (Ligações do Dia).
 *
 * Camada de tarefas sobre `crm_leads`: nada aqui move etapas nem cria
 * pipeline paralelo. A elegibilidade é sempre recalculada a partir do
 * estado atual do lead na origem somado ao histórico real de execução.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CADENCE_ACTIVATION_DATE,
  cadenceCycleDate,
  commercialDate,
  ELIGIBLE_STAGE_KEYS,
  isEligibleStage,
  nextCallAttempt,
  nextCadenceStep,
  type CadenceChannel,
  type CadenceAttempt,
  type CallOutcome,
} from "@/lib/crm/cadence";

export type CadenceQueueItem = {
  leadId: string;
  name: string;
  phone: string;
  stageKey: string | null;
  entryDate: string;
  step: number;
  dueDate: string;
  overdue: boolean;
  externalId: string;
  /** Tentativas já realizadas neste ciclo, em ordem. */
  attempts: { step: number; date: string; outcome: CallOutcome }[];
};

export async function buildCadenceQueue(
  channel: CadenceChannel = "call",
): Promise<CadenceQueueItem[]> {
  const today = commercialDate();

  const { data: leads, error } = await supabaseAdmin
    .from("crm_leads")
    .select(
      "id,external_id,name,phone,stage_key,external_created_at,ingested_at,last_entry_at,stage_entered_at",
    )
    .in("stage_key", [...ELIGIBLE_STAGE_KEYS])
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = leads ?? [];
  if (rows.length === 0) return [];

  const { data: tasks } = await supabaseAdmin
    .from("crm_cadence_tasks")
    .select("lead_id,step_day,cycle_date,completed_at,due_date,outcome")
    .eq("channel", channel)
    .eq("status", "DONE")
    .in(
      "lead_id",
      rows.map((r) => r.id),
    );

  // Histórico real por lead + ciclo: cada conclusão guarda a data em que
  // a ligação aconteceu de verdade e o desfecho informado pelo
  // Executivo — é daí que parte (ou não) o próximo passo.
  const done = new Map<string, CadenceAttempt[]>();
  for (const task of tasks ?? []) {
    const key = `${task.lead_id}::${task.cycle_date}`;
    const list = done.get(key) ?? [];
    list.push({
      step: task.step_day,
      date: commercialDate(task.completed_at ?? task.due_date),
      outcome: (task as { outcome?: string | null }).outcome === "NAO" ? "NAO" : "SIM",
    });
    done.set(key, list);
  }

  const queue: CadenceQueueItem[] = [];
  for (const row of rows) {
    if (!isEligibleStage(row.stage_key)) continue;
    const cycleDate = cadenceCycleDate({
      lastEntryAt: row.last_entry_at,
      externalCreatedAt: row.external_created_at,
      ingestedAt: row.ingested_at,
    });
    if (!cycleDate) continue;
    // Histórico anterior à ativação não vira fila retroativa.
    if (cycleDate < CADENCE_ACTIVATION_DATE) continue;

    // §3 — a contagem começa na TRANSIÇÃO para a etapa elegível
    // (ZERO CONTATO / FRIO). Sem transição registrada, a entrada
    // comercial do ciclo permanece como referência.
    const stageDate = row.stage_entered_at ? commercialDate(row.stage_entered_at) : "";
    const baseDate = stageDate && stageDate > cycleDate ? stageDate : cycleDate;

    const history = (done.get(`${row.id}::${cycleDate}`) ?? []).sort((a, b) => a.step - b.step);
    const next =
      channel === "call"
        ? nextCallAttempt(baseDate, history)
        : nextCadenceStep(
            channel,
            baseDate,
            history.map((h) => h.date),
          );
    if (!next) continue;
    if (next.dueDate > today) continue;
    queue.push({
      leadId: row.id,
      externalId: row.external_id,
      name: row.name,
      phone: row.phone,
      stageKey: row.stage_key,
      entryDate: cycleDate,
      step: next.step,
      dueDate: next.dueDate,
      overdue: next.dueDate < today,
      attempts: history,
    });
  }

  // Prioridade operacional: atrasadas mais antigas primeiro, depois as
  // que vencem hoje. Nunca ordenar por nome antes da data.
  queue.sort((a, b) =>
    a.dueDate === b.dueDate
      ? a.entryDate === b.entryDate
        ? a.name.localeCompare(b.name)
        : a.entryDate < b.entryDate
          ? -1
          : 1
      : a.dueDate < b.dueDate
        ? -1
        : 1,
  );
  return queue;
}

/**
 * Conclui a tentativa: "eu realizei esta ligação". Não encerra a
 * cadência, não move o lead e não escreve nota artificial — apenas
 * registra a atividade executada, que passa a ancorar o próximo passo.
 */
export async function completeCadenceTask(input: {
  leadId: string;
  step: number;
  channel: CadenceChannel;
  dueDate: string;
  cycleDate: string;
  userId: string;
  /** Desfecho informado pelo Executivo: atendeu (SIM) ou não (NAO). */
  outcome?: CallOutcome;
}): Promise<void> {
  const outcome: CallOutcome = input.outcome ?? "SIM";
  const { error } = await supabaseAdmin.from("crm_cadence_tasks").upsert(
    {
      lead_id: input.leadId,
      channel: input.channel,
      step_day: input.step,
      cycle_date: input.cycleDate,
      due_date: input.dueDate,
      status: "DONE",
      outcome,
      completed_at: new Date().toISOString(),
      completed_by: input.userId,
    },
    { onConflict: "lead_id,channel,cycle_date,step_day" },
  );
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("crm_lead_events").insert({
    lead_id: input.leadId,
    type: "CADENCE_TASK_DONE",
    message: `${input.channel === "call" ? "Ligação" : "Mensagem"} ${input.step}ª tentativa — ${
      outcome === "SIM" ? "investidor atendeu" : "investidor não atendeu"
    }.`,
    data: {
      channel: input.channel,
      step: input.step,
      outcome,
      dueDate: input.dueDate,
      cycleDate: input.cycleDate,
    },
  });
}

/**
 * Tentativa manual de ligação pelo WhatsApp (COMANDO 2A §13).
 *
 * É apenas um registro de atividade: não conclui a tentativa do dia,
 * não move o lead e não dispara nada pela API da Meta.
 */
export async function registerWhatsappCallAttempt(input: {
  leadId: string;
  step: number;
  cycleDate: string;
  userId: string;
}): Promise<void> {
  await supabaseAdmin.from("crm_lead_events").insert({
    lead_id: input.leadId,
    type: "CADENCE_WHATSAPP_CALL_ATTEMPT",
    message: `Tentativa manual de ligação pelo WhatsApp na ${input.step}ª tentativa.`,
    data: { channel: "whatsapp_manual", step: input.step, cycleDate: input.cycleDate },
  });
}
