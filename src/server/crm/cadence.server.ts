/**
 * Fila de execução comercial (Ligações do Dia).
 *
 * Camada de tarefas sobre `crm_leads`: nada aqui move etapas nem cria
 * pipeline paralelo. A elegibilidade é sempre recalculada a partir do
 * estado atual do lead na origem somado ao histórico de tarefas.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  cadenceBaseDate,
  commercialDate,
  dueDateForStep,
  ELIGIBLE_STAGE_KEYS,
  isEligibleStage,
  nextStep,
  type CadenceChannel,
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
};

export async function buildCadenceQueue(
  channel: CadenceChannel = "call",
): Promise<CadenceQueueItem[]> {
  const today = commercialDate();

  const { data: leads, error } = await supabaseAdmin
    .from("crm_leads")
    .select("id,external_id,name,phone,stage_key,external_created_at,ingested_at")
    .in("stage_key", [...ELIGIBLE_STAGE_KEYS])
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = leads ?? [];
  if (rows.length === 0) return [];

  const { data: tasks } = await supabaseAdmin
    .from("crm_cadence_tasks")
    .select("lead_id,step_day")
    .eq("channel", channel)
    .eq("status", "DONE")
    .in(
      "lead_id",
      rows.map((r) => r.id),
    );

  const done = new Map<string, number[]>();
  for (const task of tasks ?? []) {
    const list = done.get(task.lead_id) ?? [];
    list.push(task.step_day);
    done.set(task.lead_id, list);
  }

  const queue: CadenceQueueItem[] = [];
  for (const row of rows) {
    if (!isEligibleStage(row.stage_key)) continue;
    const entryDate = cadenceBaseDate({
      externalCreatedAt: row.external_created_at,
      ingestedAt: row.ingested_at,
    });
    if (!entryDate) continue;
    const step = nextStep(channel, done.get(row.id) ?? []);
    if (step === null) continue;
    const dueDate = dueDateForStep(entryDate, step);
    if (dueDate > today) continue;
    queue.push({
      leadId: row.id,
      externalId: row.external_id,
      name: row.name,
      phone: row.phone,
      stageKey: row.stage_key,
      entryDate,
      step,
      dueDate,
      overdue: dueDate < today,
    });
  }

  // Mais atrasados primeiro: a fila do dia começa pelo que esperou mais.
  queue.sort((a, b) => (a.dueDate === b.dueDate ? a.name.localeCompare(b.name) : a.dueDate < b.dueDate ? -1 : 1));
  return queue;
}

/**
 * Conclui a ocorrência de hoje. Não encerra a cadência e não altera o
 * lead: o próximo passo continua previsto normalmente.
 */
export async function completeCadenceTask(input: {
  leadId: string;
  step: number;
  channel: CadenceChannel;
  dueDate: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("crm_cadence_tasks").upsert(
    {
      lead_id: input.leadId,
      channel: input.channel,
      step_day: input.step,
      due_date: input.dueDate,
      status: "DONE",
      completed_at: new Date().toISOString(),
      completed_by: input.userId,
    },
    { onConflict: "lead_id,channel,step_day" },
  );
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("crm_lead_events").insert({
    lead_id: input.leadId,
    type: "CADENCE_TASK_DONE",
    message: `Tentativa de ${input.channel === "call" ? "ligação" : "mensagem"} D${input.step} concluída.`,
    data: { channel: input.channel, step: input.step, dueDate: input.dueDate },
  });
}