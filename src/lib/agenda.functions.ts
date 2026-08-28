import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type AgendaItem,
  type AgendaPriority,
  type AgendaRange,
  type AgendaDraft,
  type AgendaCreateResult,
} from "@/lib/agenda-types";

/**
 * AGENDA OPERACIONAL GLOBAL.
 *
 * A Agenda NÃO cria regras: ela apenas CONSOLIDA e apresenta
 *   1. compromissos próprios (`workspace_agenda_events`);
 *   2. reuniões já existentes (`portal_meetings`) — somente leitura;
 *   3. ações já calculadas pelo motor de cadência (`crm_cadence_tasks`).
 *
 * IDENTIDADE: o executivo é resolvido NO SERVIDOR (`current_executive_id()`).
 * Nenhum identificador vindo do cliente é aceito.
 *
 * HORÁRIO: ações de cadência NÃO possuem horário — elas vivem em uma faixa
 * própria do dia ("Ações do dia"). Nenhum horário é fabricado.
 */

export const listAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AgendaRange) => data)
  .handler(async ({ data, context }): Promise<AgendaItem[]> => {
    const supabase = context.supabase;
    const { data: selfId } = await supabase.rpc("current_executive_id");
    if (!selfId) return [];

    const items: AgendaItem[] = [];
    const dayOf = (iso: string) =>
      new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    const { data: events } = await supabase
      .from("workspace_agenda_events")
      .select("id,title,starts_at,ends_at,priority,note")
      .eq("executive_id", selfId)
      .gte("starts_at", data.fromISO)
      .lte("starts_at", data.toISO)
      .order("starts_at", { ascending: true });

    for (const e of events ?? []) {
      items.push({
        id: e.id,
        title: e.title,
        kind: "compromisso",
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        dateISO: dayOf(e.starts_at),
        priority: (e.priority as AgendaPriority) ?? "maxima",
        note: e.note,
        readOnly: false,
      });
    }

    // Reuniões existentes — representadas, nunca duplicadas nem alteradas.
    const { data: meetings } = await supabase
      .from("portal_meetings")
      .select("id,investor_name,scheduled_at,duration_min,status,topic")
      .eq("executive_id", selfId)
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
        kind: "reuniao",
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        dateISO: dayOf(start.toISOString()),
        priority: "maxima",
        note: m.topic ?? m.status,
        readOnly: true,
      });
    }

    // Ações do motor de cadência — leitura performática e já filtrada pelo
    // responsável no servidor. Sem horário: faixa própria do dia.
    const { data: tasks } = await supabase.rpc("agenda_cadence_tasks", {
      _from: data.fromISO.slice(0, 10),
      _to: data.toISO.slice(0, 10),
    });

    for (const t of tasks ?? []) {
      items.push({
        id: `cadencia:${t.id}`,
        title: `D${t.step_day} · ${t.channel === "ligacao" ? "Ligação" : "Mensagem"} — ${t.lead_name ?? "Investidor"}`,
        kind: "acao",
        startsAt: null,
        endsAt: null,
        dateISO: t.due_date,
        priority: "minima",
        note: t.note,
        readOnly: true,
      });
    }

    return items.sort((a, b) => {
      if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
      // Ações do dia (sem horário) ficam depois dos compromissos com hora.
      if (!a.startsAt) return 1;
      if (!b.startsAt) return -1;
      return a.startsAt.localeCompare(b.startsAt);
    });
  });

export const createAgendaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AgendaDraft) => data)
  .handler(async ({ data, context }): Promise<AgendaCreateResult> => {
    const supabase = context.supabase;
    const { data: selfId } = await supabase.rpc("current_executive_id");
    if (!selfId) {
      return { ok: false, reason: "invalido", message: "Perfil de executivo não identificado." };
    }

    const title = data.title.trim();
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (!title) return { ok: false, reason: "invalido", message: "Informe o título." };
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return {
        ok: false,
        reason: "invalido",
        message: "Horário de término deve ser posterior ao início.",
      };
    }

    // Reuniões não estão na tabela protegida pelo banco: a interseção real
    // é verificada aqui (fim exclusivo, padrão `[)`).
    if (data.priority === "maxima") {
      const { data: meetings } = await supabase
        .from("portal_meetings")
        .select("investor_name,scheduled_at,duration_min,status")
        .eq("executive_id", selfId)
        .gte("scheduled_at", new Date(start.getTime() - 12 * 3600000).toISOString())
        .lte("scheduled_at", new Date(end.getTime() + 12 * 3600000).toISOString());
      for (const m of meetings ?? []) {
        if (m.status === "Cancelada") continue;
        const s = new Date(m.scheduled_at).getTime();
        const e = s + (m.duration_min ?? 30) * 60000;
        if (start.getTime() < e && end.getTime() > s) {
          return {
            ok: false,
            reason: "conflito",
            conflictWith: `Reunião · ${m.investor_name}`,
            conflictAt: new Date(s).toISOString(),
          };
        }
      }
    }

    const { data: inserted, error } = await supabase
      .from("workspace_agenda_events")
      .insert({
        executive_id: selfId,
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
      // 23P01 = violação da restrição EXCLUDE: sobreposição real no banco.
      const overlap = error?.code === "23P01";
      if (overlap) {
        const { data: conflict } = await supabase
          .from("workspace_agenda_events")
          .select("title,starts_at")
          .eq("executive_id", selfId)
          .eq("priority", "maxima")
          .lt("starts_at", end.toISOString())
          .gt("ends_at", start.toISOString())
          .order("starts_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        return {
          ok: false,
          reason: "conflito",
          conflictWith: conflict?.title ?? "Compromisso existente",
          conflictAt: conflict?.starts_at ?? start.toISOString(),
        };
      }
      return { ok: false, reason: "invalido", message: error?.message ?? "Falha ao gravar." };
    }
    return { ok: true, id: inserted.id };
  });

export const deleteAgendaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: selfId } = await supabase.rpc("current_executive_id");
    if (!selfId) return { ok: false, error: "Perfil de executivo não identificado." };
    const { error } = await supabase
      .from("workspace_agenda_events")
      .delete()
      .eq("id", data.id)
      .eq("executive_id", selfId);
    return { ok: !error, error: error?.message ?? null };
  });
