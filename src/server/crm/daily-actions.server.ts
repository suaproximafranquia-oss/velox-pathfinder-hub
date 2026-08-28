/**
 * AÇÕES DO DIA — agregador de leitura.
 *
 * Reúne, em uma única lista, o que o Executivo precisa fazer hoje.
 * Nada é criado aqui: as obrigações continuam nascendo nas suas fontes
 * oficiais (Agenda, reuniões, fila do Motor de Relacionamento e fila
 * legada de ligações). Este módulo apenas LÊ, normaliza, deduplica e
 * ordena.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCadenceQueue } from "@/server/crm/cadence.server";
import {
  attemptLabel,
  normalizeDailyActions,
  operationalDate,
  resolveBucket,
  type DailyAction,
} from "@/lib/crm/daily-actions";

/** Situações que já encerraram a reunião — não são ação pendente. */
const CLOSED_MEETING_STATUS = new Set([
  "cancelada",
  "realizada",
  "concluida",
  "concluída",
  "nao compareceu",
  "não compareceu",
]);

type LeadIdentity = { name: string; phone: string; scope: string | null };

async function loadLeadIdentities(ids: string[]): Promise<Map<string, LeadIdentity>> {
  const map = new Map<string, LeadIdentity>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("portal_leads")
    .select("id,name,whatsapp,scope")
    .in("id", unique);
  for (const row of data ?? []) {
    map.set(row.id, {
      name: row.name ?? "Investidor",
      phone: row.whatsapp ?? "",
      scope: row.scope ?? null,
    });
  }
  return map;
}

export type DailyActionsInput = {
  /** Executivo autenticado — dono da Agenda e das reuniões exibidas. */
  executiveId: string | null;
  /** Instante de referência; o navegador nunca define a regra. */
  nowIso?: string;
};

export async function buildDailyActions(input: DailyActionsInput): Promise<DailyAction[]> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const today = operationalDate(nowIso);
  const horizonStart = new Date(new Date(nowIso).getTime() - 45 * 24 * 3600 * 1000).toISOString();
  const horizonEnd = new Date(new Date(nowIso).getTime() + 2 * 24 * 3600 * 1000).toISOString();

  const [meetingsRes, agendaRes, queueRes, cadenceQueue] = await Promise.all([
    supabaseAdmin
      .from("portal_meetings")
      .select("id,investor_id,investor_name,executive_id,executive_name,scheduled_at,duration_min,status,topic")
      .gte("scheduled_at", horizonStart)
      .lt("scheduled_at", horizonEnd)
      .limit(500),
    supabaseAdmin
      .from("workspace_agenda_events")
      .select("id,executive_id,title,starts_at,ends_at,priority,source,note")
      .gte("starts_at", horizonStart)
      .lt("starts_at", horizonEnd)
      .limit(500),
    supabaseAdmin
      .from("relationship_queue")
      .select("id,lead_id,flow,step,due_at,priority,status,scope")
      .eq("status", "PENDING")
      .lt("due_at", horizonEnd)
      .limit(1000),
    buildCadenceQueue("call").catch(() => []),
  ]);

  const meetings = (meetingsRes.data ?? []).filter((m) => {
    if (CLOSED_MEETING_STATUS.has(String(m.status ?? "").toLowerCase())) return false;
    return !input.executiveId || m.executive_id === input.executiveId;
  });
  const agenda = (agendaRes.data ?? []).filter(
    (e) => !input.executiveId || e.executive_id === input.executiveId,
  );
  /**
   * A Agenda também registra as reuniões. Quando o mesmo horário já
   * chega por `portal_meetings`, o evento de Agenda é descartado — a
   * reunião é a fonte com maior precedência.
   */
  const meetingSlots = new Set(meetings.map((m) => new Date(m.scheduled_at).toISOString()));
  const queue = queueRes.data ?? [];

  const identities = await loadLeadIdentities([
    ...meetings.map((m) => m.investor_id as string),
    ...queue.map((q) => q.lead_id as string),
    ...cadenceQueue.map((c) => `gs_${c.externalId}`),
  ]);

  const actions: DailyAction[] = [];

  for (const meeting of meetings) {
    const startsAt = new Date(meeting.scheduled_at).toISOString();
    const identity = identities.get(meeting.investor_id as string);
    const duration = Number(meeting.duration_min ?? 60);
    actions.push({
      actionKey: `meeting:${meeting.investor_id ?? "sem-lead"}:reuniao:${startsAt}`,
      source: "meeting",
      kind: "reuniao",
      leadId: (meeting.investor_id as string) ?? null,
      name: identity?.name ?? meeting.investor_name ?? "Investidor",
      phone: identity?.phone ?? "",
      scope: identity?.scope ?? null,
      stepLabel: null,
      dueDate: operationalDate(startsAt),
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + duration * 60000).toISOString(),
      overdue: operationalDate(startsAt) < today,
      priorityMax: true,
      bucket: resolveBucket({ dueDate: operationalDate(startsAt), startsAt, nowIso }),
      title: meeting.topic || "Reunião com o investidor",
      responsibleName: meeting.executive_name ?? null,
      attempts: [],
    });
  }

  for (const event of agenda) {
    const startsAt = new Date(event.starts_at).toISOString();
    if (meetingSlots.has(startsAt)) continue;
    const priorityMax = String(event.priority ?? "").toLowerCase() === "maxima";
    actions.push({
      actionKey: `agenda:${event.executive_id}:compromisso:${startsAt}`,
      source: "agenda",
      kind: "compromisso",
      leadId: null,
      name: event.title ?? "Compromisso",
      phone: "",
      scope: null,
      stepLabel: null,
      dueDate: operationalDate(startsAt),
      startsAt,
      endsAt: event.ends_at ? new Date(event.ends_at).toISOString() : null,
      overdue: operationalDate(startsAt) < today,
      priorityMax,
      bucket: resolveBucket({ dueDate: operationalDate(startsAt), startsAt, nowIso }),
      title: event.title ?? "Compromisso",
      responsibleName: null,
      attempts: [],
    });
  }

  for (const item of queue) {
    const leadId = item.lead_id as string;
    const identity = identities.get(leadId);
    const dueDate = operationalDate(item.due_at);
    if (dueDate > today) continue;
    actions.push({
      actionKey: `queue:${leadId}:${item.flow}-${item.step}:${item.id}`,
      source: "queue",
      kind: "mensagem",
      leadId,
      name: identity?.name ?? "Investidor",
      phone: identity?.phone ?? "",
      scope: identity?.scope ?? null,
      stepLabel: String(item.step ?? ""),
      dueDate,
      startsAt: null,
      endsAt: null,
      overdue: dueDate < today,
      priorityMax: false,
      bucket: resolveBucket({ dueDate, startsAt: null, nowIso }),
      title: `Mensagem ${item.step}`,
      responsibleName: null,
      attempts: [],
    });
  }

  for (const item of cadenceQueue) {
    const leadId = `gs_${item.externalId}`;
    const identity = identities.get(leadId);
    actions.push({
      actionKey: `cadence:${leadId}:ligacao-${item.step}:${item.entryDate}`,
      source: "cadence",
      kind: "ligacao",
      leadId,
      name: identity?.name ?? item.name,
      phone: identity?.phone ?? item.phone,
      scope: identity?.scope ?? null,
      stepLabel: attemptLabel(item.step),
      dueDate: item.dueDate,
      startsAt: null,
      endsAt: null,
      overdue: item.overdue,
      priorityMax: false,
      bucket: resolveBucket({ dueDate: item.dueDate, startsAt: null, nowIso }),
      title: `Ligação — ${attemptLabel(item.step)}`,
      responsibleName: null,
      attempts: item.attempts,
      cadence: {
        crmLeadId: item.leadId,
        step: item.step,
        dueDate: item.dueDate,
        cycleDate: item.entryDate,
      },
    });
  }

  return normalizeDailyActions(actions);
}
