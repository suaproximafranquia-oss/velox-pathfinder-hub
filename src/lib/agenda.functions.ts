import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AGENDA OPERACIONAL GLOBAL.
 *
 * A Agenda NÃO cria regras: ela apenas CONSOLIDA e apresenta
 *   1. eventos próprios (tabela `workspace_agenda_events`);
 *   2. reuniões já existentes (`portal_meetings`) — somente leitura;
 *   3. ações já calculadas pelo motor de cadência (`crm_cadence_tasks`).
 *
 * Nenhuma ação é inventada e nenhuma reunião é duplicada.
 */

export type AgendaPriority = "maxima" | "media" | "minima";

export type AgendaItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  priority: AgendaPriority;
  source: "agenda" | "reuniao" | "cadencia";
  note?: string | null;
  /** Itens somente leitura não podem ser editados/removidos na Agenda. */
  readOnly: boolean;
};

export type AgendaRange = { executiveId: string; fromISO: string; toISO: string };

export const listAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AgendaRange) => data)
  .handler(async ({ data, context }): Promise<AgendaItem[]> => {
    const supabase = context.supabase;
    const items: AgendaItem[] = [];

    const { data: events } = await supabase
      .from("workspace_agenda_events")
      .select("id,title,starts_at,ends_at,priority,source,note")
      .eq("executive_id", data.executiveId)
      .gte("starts_at", data.fromISO)
      .lte("starts_at", data.toISO)
      .order("starts_at", { ascending: true });

    for (const e of events ?? []) {
      items.push({
        id: e.id,
        title: e.title,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        priority: (e.priority as AgendaPriority) ?? "maxima",
        source: "agenda",
        note: e.note,
        readOnly: false,
      });
    }

    // Reuniões existentes — representadas, nunca duplicadas nem alteradas.
    const { data: meetings } = await supabase
      .from("portal_meetings")
      .select("id,investor_name,scheduled_at,duration_min,status,topic")
      .eq("executive_id", data.executiveId)
      .gte("scheduled_at", data.fromISO)
      .lte("scheduled_at", data.toISO)
      .order("scheduled_at", { ascending: true });

    for (const m of meetings ?? []) {
      if (m.status === "Cancelada") continue;
      const start = new Date(m.scheduled_at);
      const end = new Date(start.getTime() + (m.duration_min ?? 30) * 60000);
      items.push({
        id: `meeting:${m.id}`,
        title: `Reunião · ${m.investor_name}`,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        priority: "maxima",
        source: "reuniao",
        note: m.topic ?? m.status,
        readOnly: true,
      });
    }

    // Ações já determinadas pelo motor de cadência (prioridade mínima).
    const { data: leads } = await supabase
      .from("portal_leads")
      .select("id,name")
      .eq("responsible_executive_id", data.executiveId);
    const leadMap = new Map((leads ?? []).map((l) => [l.id, l.name]));
    if (leadMap.size > 0) {
      const { data: tasks } = await supabase
        .from("crm_cadence_tasks")
        .select("id,lead_id,due_date,step_day,channel,status,note")
        .in("lead_id", Array.from(leadMap.keys()))
        .eq("status", "pendente")
        .gte("due_date", data.fromISO.slice(0, 10))
        .lte("due_date", data.toISO.slice(0, 10));
      for (const t of tasks ?? []) {
        items.push({
          id: `cadencia:${t.id}`,
          title: `D${t.step_day} · ${t.channel === "ligacao" ? "Ligação" : "Mensagem"} — ${leadMap.get(t.lead_id) ?? "Investidor"}`,
          startsAt: new Date(`${t.due_date}T09:00:00-03:00`).toISOString(),
          endsAt: null,
          priority: "minima",
          source: "cadencia",
          note: t.note,
          readOnly: true,
        });
      }
    }

    return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  });

export type AgendaDraft = {
  executiveId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  priority: AgendaPriority;
  note?: string | null;
};

export type AgendaCreateResult =
  | { ok: true; id: string }
  | { ok: false; reason: "conflito"; conflictWith: string; conflictAt: string }
  | { ok: false; reason: "invalido"; message: string };

export const createAgendaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AgendaDraft) => data)
  .handler(async ({ data, context }): Promise<AgendaCreateResult> => {
    const supabase = context.supabase;
    const title = data.title.trim();
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (!title) return { ok: false, reason: "invalido", message: "Informe o título." };
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { ok: false, reason: "invalido", message: "Horário de término deve ser posterior ao início." };
    }

    // Conflito só se aplica a compromissos reais (prioridade máxima).
    if (data.priority === "maxima") {
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(end);
      dayEnd.setHours(23, 59, 59, 999);

      const existing = await listAgenda({
        data: {
          executiveId: data.executiveId,
          fromISO: dayStart.toISOString(),
          toISO: dayEnd.toISOString(),
        },
      });
      const overlap = existing.find((item) => {
        if (item.priority !== "maxima" || !item.endsAt) return false;
        const s = new Date(item.startsAt).getTime();
        const e = new Date(item.endsAt).getTime();
        return start.getTime() < e && end.getTime() > s;
      });
      if (overlap) {
        return {
          ok: false,
          reason: "conflito",
          conflictWith: overlap.title,
          conflictAt: overlap.startsAt,
        };
      }
    }

    const { data: inserted, error } = await supabase
      .from("workspace_agenda_events")
      .insert({
        executive_id: data.executiveId,
        title,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        priority: data.priority,
        source: "agenda",
        note: data.note ?? null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { ok: false, reason: "invalido", message: error?.message ?? "Falha ao gravar." };
    }
    return { ok: true, id: inserted.id };
  });

export const deleteAgendaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_agenda_events")
      .delete()
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });
