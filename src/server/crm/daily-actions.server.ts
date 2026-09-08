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
import {
  availabilityDate,
  availabilityFromDate,
  isOverdueByBusinessDays,
} from "@/lib/crm/daily-actions-overdue";
import { stepDisplayLabel } from "@/lib/relationship/step-labels";
import { listClosureDuties } from "@/server/relationship/closure.server";
import { listPendingE0Actions } from "@/server/crm/e0-actions.server";

import { listSkippedActionKeys } from "@/server/crm/daily-actions-log.server";
import { listHistoricalCycleLeadIds } from "@/server/relationship/cycle.server";
import { FOLLOW_UP_STATES } from "@/lib/crm/greensales-followup";

/** Situações que já encerraram a reunião — não são ação pendente. */
const CLOSED_MEETING_STATUS = new Set([
  "cancelada",
  "realizada",
  "concluida",
  "concluída",
  "nao compareceu",
  "não compareceu",
]);

type LeadIdentity = {
  name: string;
  phone: string;
  scope: string | null;
  /** Card fora da operação atual (arquivado no ponto zero). */
  archived: boolean;
  /** Executivo responsável pelo card (titularidade vigente). */
  responsibleExecutiveId: string | null;
};

async function loadLeadIdentities(ids: string[]): Promise<Map<string, LeadIdentity>> {
  const map = new Map<string, LeadIdentity>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("portal_leads")
    .select("id,name,whatsapp,scope,archived_at,responsible_executive_id")
    .in("id", unique);
  for (const row of data ?? []) {
    map.set(row.id, {
      name: row.name ?? "Investidor",
      phone: row.whatsapp ?? "",
      scope: row.scope ?? null,
      archived: Boolean((row as { archived_at?: string | null }).archived_at),
      responsibleExecutiveId:
        ((row as { responsible_executive_id?: string | null }).responsible_executive_id ?? null),
    });
  }
  return map;
}

/** Título oficial do item da fila da régua V2 — vocabulário E0–E8/R/RE. */
function queueActionTitle(step: string, isCall: boolean, order: number): string {
  if (isCall) return order > 1 ? `Segunda ligação — Etapa ${step}` : `Ligação — Etapa ${step}`;
  return `Copiar mensagem — Etapa ${step}`;
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

  /**
   * E0 MANUAL → RÉGUA V2 (idempotente). Garante que todo lead NOVO de
   * executivo em modo manual tenha a E0 na fila do motor ANTES da
   * leitura abaixo. Uma falha aqui NÃO reabre o caminho legado: o card
   * antigo de primeiro contato deixou de existir como ação operacional.
   */
  await import("@/server/relationship/e0-manual.server")
    .then((m) => m.ensureManualE0Cadences())
    .catch(() => new Set<string>());



  const [meetingsRes, agendaRes, queueRes, cadenceQueue, closureDuties, firstContacts] =
    await Promise.all([
    supabaseAdmin
      .from("portal_meetings")
      .select(
        "id,investor_id,investor_name,executive_id,executive_name,scheduled_at,duration_min,status,topic,external_source,follow_up_state,follow_up_review_due_at",
      )
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
      .select("id,lead_id,flow,step,due_at,priority,status,scope,action_order,action_kind,claimed_by")
      // PROCESSING = ação reivindicada pelo executivo (posição 1 protegida).
      .in("status", ["PENDING", "PROCESSING"])
      .lt("due_at", horizonEnd)
      .limit(1000),
    /**
     * L1–L4 APOSENTADAS: a fila legada de ligações não gera mais
     * obrigação nova. As ligações passaram a nascer na régua V2, dentro
     * da própria etapa. O histórico continua gravado e visível no lead.
     */
    Promise.resolve([] as Awaited<ReturnType<typeof buildCadenceQueue>>),
      listClosureDuties(nowIso).catch(() => []),
      listPendingE0Actions(input.executiveId).catch(() => []),
    ]);

  const meetings = (meetingsRes.data ?? []).filter((m) => {
    if (!input.executiveId || m.executive_id === input.executiveId) {
      /**
       * FINANCEIRA /f — compromisso ESPELHADO do GreenSales: a obrigação
       * existe enquanto PENDENTE (contato) ou quando a verificação de
       * 24h venceu (VENCIDO_SEM_CONTATO). Demais estados não são ação.
       */
      if (m.external_source === "greensales") {
        const state = String(m.follow_up_state ?? "");
        if (state === FOLLOW_UP_STATES.pending) return true;
        if (state === FOLLOW_UP_STATES.expiredNoContact) {
          const due = m.follow_up_review_due_at ? Date.parse(m.follow_up_review_due_at) : NaN;
          return Number.isFinite(due) && due <= Date.parse(nowIso);
        }
        return false;
      }
      return !CLOSED_MEETING_STATUS.has(String(m.status ?? "").toLowerCase());
    }
    return false;
  });
  /**
   * Compromissos marcados como `historico` foram encerrados na operação
   * e permanecem gravados apenas para auditoria — nunca voltam à fila.
   */
  const agenda = (agendaRes.data ?? []).filter(
    (e) =>
      String((e as { source?: string | null }).source ?? "agenda") !== "historico" &&
      (!input.executiveId || e.executive_id === input.executiveId),
  );

  /**
   * A Agenda também registra as reuniões. Quando o mesmo horário já
   * chega por `portal_meetings`, o evento de Agenda é descartado — a
   * reunião é a fonte com maior precedência.
   */
  const meetingSlots = new Set(meetings.map((m) => new Date(m.scheduled_at).toISOString()));
  const queue = queueRes.data ?? [];
  const historicalLeadIds = await listHistoricalCycleLeadIds(
    queue.map((q) => q.lead_id as string),
  );

  const identities = await loadLeadIdentities([
    ...meetings.map((m) => m.investor_id as string),
    ...queue.map((q) => q.lead_id as string),
    ...cadenceQueue.map((c) => `gs_${c.externalId}`),
    ...closureDuties.map((d) => d.leadId),
    ...firstContacts.map((a) => a.card_id),
  ]);

  const actions: DailyAction[] = [];

  /**
   * PRIMEIRO CONTATO (E0) — CAMINHO LEGADO ENCERRADO.
   *
   * A E0 é etapa REAL da régua V2 (ligação 1 → 10 min → ligação 2 →
   * mensagem para COPIAR) e vive exclusivamente em `relationship_queue`.
   * O card legado "Executar primeiro contato (E0)" NÃO é mais oferecido
   * como ação operacional — nem quando a reconciliação acima falha
   * (fail-closed: falha nunca reexpõe o caminho antigo).
   *
   * Os registros de `workspace_e0_actions` permanecem intactos como
   * histórico; nada é apagado nem migrado aqui.
   */


  for (const meeting of meetings) {
    const startsAt = new Date(meeting.scheduled_at).toISOString();
    const identity = identities.get(meeting.investor_id as string);
    const duration = Number(meeting.duration_min ?? 60);
    if (meeting.external_source === "greensales") {
      const review = String(meeting.follow_up_state ?? "") === FOLLOW_UP_STATES.expiredNoContact;
      const anchor = review && meeting.follow_up_review_due_at
        ? new Date(meeting.follow_up_review_due_at).toISOString()
        : startsAt;
      actions.push({
        actionKey: `meeting:${meeting.investor_id}:${review ? "revisao24h" : "agendamento"}:${anchor}`,
        source: "meeting",
        kind: "reuniao",
        leadId: meeting.investor_id as string,
        name: identity?.name ?? meeting.investor_name ?? "Investidor",
        phone: identity?.phone ?? "",
        scope: identity?.scope ?? null,
        stepLabel: review ? "Verificação 24h" : "Agendamento",
        dueDate: operationalDate(anchor),
        startsAt: anchor,
        endsAt: review ? null : new Date(new Date(startsAt).getTime() + duration * 60000).toISOString(),
        overdue: operationalDate(anchor) < today,
        priorityMax: true,
        bucket: review
          ? (operationalDate(anchor) < today ? "atrasada" : "agora")
          : resolveBucket({ dueDate: operationalDate(startsAt), startsAt, nowIso }),
        title: review ? "Verificar agendamento sem contato (24h)" : "Agendamento (GreenSales)",
        responsibleName: meeting.executive_name ?? null,
        attempts: [],
        meetingId: meeting.id as string,
        followUp: {
          mode: review ? "revisao_24h" : "contato",
          state: meeting.follow_up_state ?? null,
          scheduledAt: startsAt,
          reviewDueAt: meeting.follow_up_review_due_at ?? null,
        },
      });
      continue;
    }
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
      meetingId: meeting.id as string,
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

  /**
   * FECHAMENTO DO CICLO — E27 e FINALIZAÇÃO da Apresentação Digital.
   * A mesma leitura usada pelo executor: a Ação do Dia nunca inventa
   * obrigação, só mostra a que já venceu na ocorrência da E20.
   */
  for (const duty of closureDuties) {
    const identity = identities.get(duty.leadId);
    actions.push({
      actionKey: `closure:${duty.leadId}:${duty.step}:${duty.occurrenceId}`,
      source: "closure",
      kind: "mensagem",
      leadId: duty.leadId,
      name: identity?.name ?? "Investidor",
      phone: identity?.phone ?? "",
      scope: identity?.scope ?? null,
      stepLabel: stepDisplayLabel(duty.step),
      dueDate: duty.dueDate,
      startsAt: null,
      endsAt: null,
      overdue: isOverdueByBusinessDays(availabilityFromDate(duty.dueDate), nowIso),
      priorityMax: false,
      bucket: isOverdueByBusinessDays(availabilityFromDate(duty.dueDate), nowIso)
        ? "atrasada"
        : duty.dueDate > operationalDate(nowIso)
          ? "futura"
          : "hoje",
      title:
        duty.kind === "checkpoint"
          ? "Checkpoint da Apresentação Digital"
          : "Finalização do ciclo",
      responsibleName: null,
      attempts: [],
      messageRef: { step: duty.step, flow: null, origin: "closure" },
    });
  }

  for (const item of queue) {
    const leadId = item.lead_id as string;
    // BLOCO 1 — dívida de ciclo histórico não vira trabalho de hoje.
    if (historicalLeadIds.has(leadId)) continue;
    const identity = identities.get(leadId);
    const dueDate = operationalDate(item.due_at);
    if (dueDate > today) continue;
    const step = String(item.step ?? "");
    const isCall = (item as { action_kind?: string | null }).action_kind === "call";
    const order = Number((item as { action_order?: number | null }).action_order ?? 1);
    const claimed = item.status === "PROCESSING";
    /**
     * AÇÃO INTERNA COM ESPERA (2ª ligação em +10 min, mensagem após a
     * 2ª ligação): só aparece quando o horário de liberação chegou. A
     * ordem dentro da etapa é do motor, não da tela.
     */
    if (order > 1 && String(item.due_at) > nowIso) continue;
    /**
     * E0 é a etapa do lead NOVO: pertence ao executivo responsável pelo
     * card (mesma regra da ação legada). Sem responsável, continua
     * visível — nada se perde.
     */
    if (
      step === "E0" &&
      input.executiveId &&
      identity?.responsibleExecutiveId &&
      identity.responsibleExecutiveId !== input.executiveId
    ) {
      continue;
    }
    // LEAD NOVO NÃO NASCE ATRASADO: E0 pendente é classe NOVO, no topo.
    const isE0 = step === "E0";
    const overdue = isE0 ? false : isOverdueByBusinessDays(availabilityFromDate(dueDate), nowIso);
    actions.push({
      actionKey: `queue:${leadId}:${item.flow}-${step}-${order}:${item.id}`,
      source: "queue",
      kind: isCall ? "ligacao" : "mensagem",
      leadId,
      name: identity?.name ?? "Investidor",
      phone: identity?.phone ?? "",
      scope: identity?.scope ?? null,
      stepLabel: step,
      dueDate,
      startsAt: null,
      endsAt: null,
      overdue,
      priorityMax: isE0,
      bucket: overdue ? "atrasada" : "hoje",
      // Ligação é ligação; mensagem é COPIAR o texto oficial da Biblioteca.
      title: queueActionTitle(step, isCall, order),
      responsibleName: identity?.responsibleExecutiveId ?? null,
      attempts: [],
      claimed,
      queueItemId: String(item.id),
      queueActionOrder: order,
      ...(isCall
        ? {}
        : {
            messageRef: {
              step,
              flow: (item.flow as string) ?? null,
              origin: "queue" as const,
            },
          }),
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
      /**
       * Tentativa só é exibida quando existe histórico REAL de tentativas
       * registradas na origem. `step_day` é dia de cadência, não tentativa.
       */
      stepLabel: item.attempts.length > 0 ? attemptLabel(item.attempts.length + 1) : null,
      dueDate: item.dueDate,
      startsAt: null,
      endsAt: null,
      overdue: isOverdueByBusinessDays(availabilityFromDate(item.dueDate), nowIso),
      priorityMax: false,
      bucket: isOverdueByBusinessDays(availabilityFromDate(item.dueDate), nowIso)
        ? "atrasada"
        : item.dueDate > operationalDate(nowIso)
          ? "futura"
          : "hoje",
      title: item.attempts.length > 0 ? `Ligação — ${attemptLabel(item.attempts.length + 1)}` : "Ligação",
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

  /**
   * AGUARDANDO ENCAMINHAMENTO — regra aposentada. Atender uma ligação
   * não congela a cadência, portanto não existe mais pendência de
   * encaminhamento na Ação do Dia. Os registros antigos de
   * `awaiting_handoff` permanecem no banco como histórico e não são
   * apagados nem transformados em obrigação.
   */

  /**
   * PULADAS HOJE — a ação sai da lista do dia, mas continua registrada
   * no histórico e volta amanhã se a fonte oficial seguir pendente.
   */
  const skipped = await listSkippedActionKeys(nowIso).catch(() => new Set<string>());
  const visible = skipped.size ? actions.filter((a) => !skipped.has(a.actionKey)) : actions;

  /**
   * RECONCILIAÇÃO DA FILA OPERACIONAL ATUAL.
   *
   * A obrigação só é trabalho de hoje quando o LEAD ainda está na
   * carteira operacional vigente. Card inexistente ou ARQUIVADO (ponto
   * zero) não gera ação. Nada é apagado: histórico, timeline, auditoria
   * e as fontes oficiais permanecem intactos — apenas não são exibidos
   * como tarefa pendente. Ações sem lead (Agenda) seguem inalteradas.
   */
  const operational = visible.filter((a) => {
    if (!a.leadId) return true;
    const identity = identities.get(a.leadId);
    return Boolean(identity) && !identity!.archived;
  });

  return normalizeDailyActions(operational);
}

