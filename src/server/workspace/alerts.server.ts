/**
 * Central de Alertas — derivação server-side (ETAPA 1).
 *
 * REGRA ARQUITETURAL: nenhum acontecimento operacional real depende de
 * localStorage. Todos os alertas abaixo são derivados EXCLUSIVAMENTE de
 * tabelas já existentes no servidor:
 *
 *   portal_leads            → Novo Investidor / Manual concluído
 *   portal_journey_events   → Atividade no Portal / Manual / Simulação
 *   portal_engagement       → Movimentação (retorno) / Engajamento elevado
 *   portal_meetings         → Reuniões (lembrete e mudanças de status)
 *   lead_ownership_history  → Redistribuição de lead
 *
 * NÃO gerado nesta etapa:
 *   "Contato Solicitado" (contato_whatsapp) — hoje não existe registro
 *   server-side desse pedido. Será tratado quando o evento passar a ser
 *   persistido no servidor. Não inventamos fonte nem usamos estado local.
 *
 * O recorte por executivo responsável é garantido pelas políticas RLS já
 * existentes: o cliente recebido aqui é o cliente autenticado do usuário.
 *
 * Identidade estável: cada alerta deriva seu ID de um registro real
 * (id do lead, id do evento, id da reunião, id da titularidade). Abrir a
 * página novamente NUNCA cria um alerta novo do mesmo acontecimento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ServerAlertCategory =
  | "movimentacao"
  | "atividade_portal"
  | "novo_lead"
  | "manual_concluido"
  | "simulacao"
  | "engajamento_alto"
  | "reuniao"
  | "reuniao_confirmada"
  | "reuniao_cancelada"
  | "lead_redistribuido";

export type ServerWorkspaceAlert = {
  id: string;
  category: ServerAlertCategory;
  title: string;
  description: string;
  investorId?: string;
  investorName?: string;
  investorEmail?: string;
  investorWhatsapp?: string;
  date: string;
  actionUrl?: string;
  archived: boolean;
};

const RESOLVED_AFTER_DAYS = 30;
const MAX_ALERTS = 300;

function isOld(iso: string, now: number): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return now - t > RESOLVED_AFTER_DAYS * 86_400_000;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  whatsapp: string | null;
  created_at: string;
  journey_completed_at: string | null;
  last_activity_at: string | null;
  is_test: boolean | null;
};

type EventRow = {
  id: string;
  investor_id: string;
  event: string;
  module: string | null;
  detail: string | null;
  created_at: string;
};

type EngagementRow = {
  investor_id: string;
  sessions: number;
  returns: number;
  active_ms: number;
  first_access_at: string;
  last_access_at: string;
};

type MeetingRow = {
  id: string;
  investor_id: string | null;
  investor_name: string | null;
  status: string;
  scheduled_at: string;
  meet_url: string | null;
  updated_at: string;
};

type OwnershipRow = {
  id: string;
  card_id: string;
  previous_executive_id: string | null;
  new_executive_id: string;
  changed_at: string;
  reason: string | null;
};

/**
 * Deriva a lista de alertas reais do executivo autenticado.
 * `supabase` DEVE ser o cliente autenticado (RLS aplica o recorte).
 */
export async function buildWorkspaceAlerts(
  supabase: SupabaseClient,
): Promise<ServerWorkspaceAlert[]> {
  const now = Date.now();

  const { data: leadRows } = await supabase
    .from("portal_leads")
    .select(
      "id, name, email, whatsapp, created_at, journey_completed_at, last_activity_at, is_test",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const leads = ((leadRows ?? []) as LeadRow[]).filter((l) => l.is_test !== true);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const leadIds = leads.map((l) => l.id);

  if (leadIds.length === 0) return [];

  const [eventsRes, engagementRes, meetingsRes, ownershipRes] = await Promise.all([
    supabase
      .from("portal_journey_events")
      .select("id, investor_id, event, module, detail, created_at")
      .in("investor_id", leadIds)
      .in("event", ["module.opened", "journey.module.opened", "manual.completed", "simulator.completed"])
      .order("created_at", { ascending: false })
      .limit(600),
    supabase
      .from("portal_engagement")
      .select("investor_id, sessions, returns, active_ms, first_access_at, last_access_at")
      .in("investor_id", leadIds),
    supabase
      .from("portal_meetings")
      .select("id, investor_id, investor_name, status, scheduled_at, meet_url, updated_at")
      .order("scheduled_at", { ascending: false })
      .limit(200),
    supabase
      .from("lead_ownership_history")
      .select("id, card_id, previous_executive_id, new_executive_id, changed_at, reason")
      .order("changed_at", { ascending: false })
      .limit(200),
  ]);

  const events = (eventsRes.data ?? []) as EventRow[];
  const engagement = (engagementRes.data ?? []) as EngagementRow[];
  const meetings = (meetingsRes.data ?? []) as MeetingRow[];
  const ownership = (ownershipRes.data ?? []) as OwnershipRow[];

  const out: ServerWorkspaceAlert[] = [];
  const push = (a: Omit<ServerWorkspaceAlert, "archived"> & { archived?: boolean }) => {
    const lead = a.investorId ? leadById.get(a.investorId) : undefined;
    out.push({
      ...a,
      investorName: a.investorName ?? lead?.name ?? undefined,
      investorEmail: lead?.email ?? undefined,
      investorWhatsapp: lead?.whatsapp ?? undefined,
      archived: a.archived ?? isOld(a.date, now),
    });
  };

  /* 1. NOVO INVESTIDOR — portal_leads.created_at */
  for (const lead of leads.slice(0, 120)) {
    push({
      id: `srv:novo_lead:${lead.id}`,
      category: "novo_lead",
      title: `${lead.name ?? "Investidor"} entrou no Portal`,
      description: "Novo investidor identificado no servidor a partir do cadastro do lead.",
      investorId: lead.id,
      date: lead.created_at,
    });
  }

  /* 3/4/5. Eventos reais de jornada (servidor é a única fonte) */
  const lastOpened = new Map<string, EventRow>();
  for (const ev of events) {
    if (!leadById.has(ev.investor_id)) continue; // lead inexistente → nenhum alerta
    if (ev.event === "simulator.completed") {
      push({
        id: `srv:simulacao:${ev.id}`,
        category: "simulacao",
        title: `${leadById.get(ev.investor_id)?.name ?? "Investidor"} simulou o potencial de receita`,
        description: "Simulação concluída registrada no servidor (simulator.completed).",
        investorId: ev.investor_id,
        date: ev.created_at,
      });
    } else if (ev.event === "manual.completed") {
      push({
        id: `srv:manual_concluido:${ev.id}`,
        category: "manual_concluido",
        title: `${leadById.get(ev.investor_id)?.name ?? "Investidor"} concluiu o Manual`,
        description: "Conclusão do Manual registrada no servidor.",
        investorId: ev.investor_id,
        date: ev.created_at,
      });
    } else if (!lastOpened.has(ev.investor_id)) {
      lastOpened.set(ev.investor_id, ev);
    }
  }

  for (const ev of lastOpened.values()) {
    push({
      id: `srv:atividade_portal:${ev.id}`,
      category: "atividade_portal",
      title: `${leadById.get(ev.investor_id)?.name ?? "Investidor"} acessou um módulo do Portal`,
      description: `Último módulo aberto: ${ev.module ?? ev.detail ?? "Portal"}.`,
      investorId: ev.investor_id,
      date: ev.created_at,
    });
  }

  /* 4b. Manual concluído sem evento — coluna do próprio lead */
  const completedByEvent = new Set(
    events.filter((e) => e.event === "manual.completed").map((e) => e.investor_id),
  );
  for (const lead of leads) {
    if (!lead.journey_completed_at || completedByEvent.has(lead.id)) continue;
    push({
      id: `srv:manual_concluido:lead:${lead.id}`,
      category: "manual_concluido",
      title: `${lead.name ?? "Investidor"} concluiu o Manual`,
      description: "Conclusão registrada na ficha do lead (journey_completed_at).",
      investorId: lead.id,
      date: lead.journey_completed_at,
    });
  }

  /* 2/7. Movimentação e engajamento — portal_engagement + eventos */
  const eventsByInvestor = new Map<string, EventRow[]>();
  for (const ev of events) {
    const list = eventsByInvestor.get(ev.investor_id) ?? [];
    list.push(ev);
    eventsByInvestor.set(ev.investor_id, list);
  }

  for (const eng of engagement) {
    const lead = leadById.get(eng.investor_id);
    if (!lead) continue;

    // Retorno real: o servidor contabilizou retorno e há acesso posterior
    // ao primeiro. Identidade por DIA do retorno — não por atividade.
    if ((eng.returns ?? 0) > 0 && eng.last_access_at > eng.first_access_at) {
      push({
        id: `srv:movimentacao:${eng.investor_id}:${dayKey(eng.last_access_at)}`,
        category: "movimentacao",
        title: `${lead.name ?? "Investidor"} voltou a acessar o Portal`,
        description: `Retorno registrado no servidor — ${eng.returns} retorno(s), ${eng.sessions} sessão(ões).`,
        investorId: eng.investor_id,
        date: eng.last_access_at,
      });
    }

    // Engajamento elevado: mesma régua já usada pela plataforma
    // (tempo efetivo, retornos, simulações e módulos), agora calculada
    // sobre dados do servidor.
    const list = eventsByInvestor.get(eng.investor_id) ?? [];
    const simulations = list.filter((e) => e.event === "simulator.completed").length;
    const modules = new Set(list.filter((e) => e.module).map((e) => e.module)).size;
    const minutes = (eng.active_ms ?? 0) / 60000;
    const score = Math.round(
      Math.min(20, (minutes / 25) * 20) +
        Math.min(18, (eng.returns ?? 0) * 6) +
        Math.min(12, simulations * 6) +
        Math.min(8, modules * 4),
    );
    const signals: string[] = [];
    if (simulations > 0) signals.push("simulou potencial de receita");
    if ((eng.returns ?? 0) >= 1) signals.push("retornou ao Portal");
    if (modules >= 2) signals.push("percorreu vários módulos");
    if (score >= 30 && signals.length >= 2) {
      push({
        id: `srv:engajamento_alto:${eng.investor_id}`,
        category: "engajamento_alto",
        title: `${lead.name ?? "Investidor"} apresenta engajamento elevado`,
        description: `Sinais de intenção: ${signals.join(", ")}.`,
        investorId: eng.investor_id,
        date: eng.last_access_at,
      });
    }
  }

  /* 8. Reuniões — portal_meetings */
  for (const m of meetings) {
    const when = Date.parse(m.scheduled_at);
    const status = (m.status ?? "").toLowerCase();
    if (status.startsWith("cancel")) {
      push({
        id: `srv:reuniao_cancelada:${m.id}`,
        category: "reuniao_cancelada",
        title: `Reunião cancelada — ${m.investor_name ?? "Investidor"}`,
        description: "Cancelamento registrado no servidor.",
        investorId: m.investor_id ?? undefined,
        date: m.updated_at ?? m.scheduled_at,
      });
      continue;
    }
    if (status.startsWith("confirm")) {
      push({
        id: `srv:reuniao_confirmada:${m.id}`,
        category: "reuniao_confirmada",
        title: `Reunião confirmada — ${m.investor_name ?? "Investidor"}`,
        description: `Agendada para ${new Date(m.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
        investorId: m.investor_id ?? undefined,
        date: m.updated_at ?? m.scheduled_at,
        actionUrl: m.meet_url ?? undefined,
      });
    }
    if (!Number.isNaN(when) && when > now && when - now <= 24 * 3_600_000) {
      push({
        id: `srv:reuniao:${m.id}`,
        category: "reuniao",
        title: `Reunião nas próximas 24h — ${m.investor_name ?? "Investidor"}`,
        description: `Início em ${new Date(m.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
        investorId: m.investor_id ?? undefined,
        date: m.scheduled_at,
        actionUrl: m.meet_url ?? undefined,
        archived: false,
      });
    }
  }

  /* 9. Movimentações de titularidade — lead_ownership_history */
  for (const row of ownership) {
    if (!row.previous_executive_id) continue;
    push({
      id: `srv:lead_redistribuido:${row.id}`,
      category: "lead_redistribuido",
      title: `Lead redistribuído — ${leadById.get(row.card_id)?.name ?? row.card_id}`,
      description: `De ${row.previous_executive_id} para ${row.new_executive_id}${row.reason ? ` — ${row.reason}` : ""}.`,
      investorId: leadById.has(row.card_id) ? row.card_id : undefined,
      date: row.changed_at,
    });
  }

  const unique = new Map<string, ServerWorkspaceAlert>();
  for (const a of out) if (!unique.has(a.id)) unique.set(a.id, a);

  return [...unique.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAX_ALERTS);
}
