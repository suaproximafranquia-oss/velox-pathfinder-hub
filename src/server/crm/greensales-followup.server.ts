/**
 * FOLLOW_UP DO GREENSALES → PORTAL_MEETINGS → AÇÃO DO DIA — SERVER ONLY.
 *
 * Exclusivo da Financeira /f. O GreenSales é a FONTE do agendamento; o
 * Portal apenas espelha, de forma idempotente, o campo estruturado
 * `follow_up` dos leads em AGENDAMENTOS na agenda existente
 * (`portal_meetings`). Nada é apagado: cancelamentos e reagendamentos
 * ficam no MESMO registro, com histórico append-only.
 *
 * O que este módulo NUNCA faz:
 *  - criar compromisso fora de AGENDAMENTOS;
 *  - mover o lead de estágio;
 *  - enviar WhatsApp;
 *  - reagendar por conta própria (reagendar é no GreenSales).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AGENDAMENTOS_STAGE,
  FOLLOW_UP_ELIGIBLE_STAGES,
  FOLLOW_UP_STATES,
  FOLLOW_UP_TOPIC,
  GREENSALES_SOURCE,
  followUpExternalRef,
  followUpMeetingId,
  followUpModality,
  VIDEO_STAGE,
  isCommitmentStageToFrios,
  planFollowUpSync,
  reviewDueAt,
  type FollowUpModality,
  type FollowUpSyncDecision,
} from "@/lib/crm/greensales-followup";

const SCOPE = "production";
const MIRROR_TOPIC = FOLLOW_UP_TOPIC.AGENDAMENTO;

/** Data legível no fuso operacional, para o histórico do lead. */
function formatBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
}

/** Data completa e legível (DD/MM/AAAA às HH:MM) para a nota. */
function formatBrFull(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

/** Rótulo do compromisso na Nota do Executivo, por modalidade. */
function noteSubject(modality: FollowUpModality | null): { noun: string; created: string; cancelled: string } {
  return modality === "VIDEOCHAMADA"
    ? { noun: "Videochamada", created: "Videochamada criada", cancelled: "Videochamada cancelada" }
    : { noun: "Agendamento", created: "Agendamento criado", cancelled: "Agendamento cancelado" };
}

/**
 * NOTA DO EXECUTIVO do compromisso — mesmo mecanismo oficial já usado
 * pela Ação do Dia (`addInvestorNote`). Idempotente pelo `source_key`;
 * falhar aqui NUNCA desfaz o espelhamento do compromisso.
 */
async function appendFollowUpNote(input: {
  leadId: string;
  externalId: string;
  kind: "criado" | "reagendado" | "cancelado";
  at: string;
  body: string;
}): Promise<void> {
  try {
    const { addInvestorNote } = await import("@/server/crm/investor-notes.server");
    await addInvestorNote({
      leadId: input.leadId,
      body: input.body,
      executiveId: null,
      authorName: "Sincronização GreenSales",
      sourceKey: `greensales:follow_up:${input.externalId}:${input.kind}:${input.at}`,
    });
  } catch {
    // Nota é registro complementar: nunca invalida a sincronização.
  }
}

type MirrorRow = {
  id: string;
  investor_id: string;
  executive_id: string;
  scheduled_at: string;
  status: string;
  topic: string | null;
  external_follow_up: string | null;
  follow_up_state: string | null;
  follow_up_review_due_at: string | null;
  follow_up_history: unknown;
};

type HistoryEntry = {
  at: string;
  event: string;
  from?: string | null;
  to?: string | null;
  state?: string | null;
  detail?: string | null;
  actor_id?: string | null;
};

function history(row: Pick<MirrorRow, "follow_up_history"> | null, entry: HistoryEntry): HistoryEntry[] {
  const prev = Array.isArray(row?.follow_up_history) ? (row!.follow_up_history as HistoryEntry[]) : [];
  return [...prev, entry].slice(-200);
}

async function appendTimeline(input: {
  leadId: string;
  event: string;
  reason: string;
  actorId?: string | null;
  at: string;
}) {
  await supabaseAdmin
    .from("crm_timeline")
    .upsert(
      {
        id: `gsfu_${input.leadId}_${input.event}_${input.at}`,
        investor_id: input.leadId,
        event: input.event,
        origin: "greensales_follow_up",
        reason: input.reason,
        owner_id: null,
        actor_id: input.actorId ?? null,
        at: input.at,
      } as never,
      { onConflict: "id", ignoreDuplicates: true },
    )
    .then(() => undefined, () => undefined);
}

/** Evento append-only e idempotente do relacionamento. */
async function appendRelationshipEvent(input: {
  leadId: string;
  eventKey: string;
  type: string;
  step?: string | null;
  data?: Record<string, unknown>;
  at: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("relationship_events").insert({
    scope: SCOPE,
    lead_id: input.leadId,
    event_key: input.eventKey,
    type: input.type,
    step: input.step ?? null,
    occurred_at: input.at,
    historical: false,
    data: input.data ?? {},
  } as never);
  // Violação do índice único = já registrado → idempotente.
  return !error;
}

async function loadMirror(externalId: string): Promise<MirrorRow | null> {
  const { data } = await supabaseAdmin
    .from("portal_meetings")
    .select(
      "id,investor_id,executive_id,scheduled_at,status,topic,external_follow_up,follow_up_state,follow_up_review_due_at,follow_up_history",
    )
    .eq("external_source", GREENSALES_SOURCE)
    .eq("external_ref", followUpExternalRef(externalId))
    .maybeSingle();
  return (data as MirrorRow | null) ?? null;
}

async function loadLeadIdentity(leadId: string): Promise<{
  name: string;
  email: string | null;
  executiveId: string | null;
  executiveName: string;
} | null> {
  const { data: lead } = await supabaseAdmin
    .from("portal_leads")
    .select("name,email,responsible_executive_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return null;
  const executiveId = (lead as { responsible_executive_id: string | null }).responsible_executive_id;
  let executiveName = "Executivo responsável";
  if (executiveId) {
    const { data: exec } = await supabaseAdmin
      .from("executive_profiles")
      .select("name")
      .eq("executive_id", executiveId)
      .maybeSingle();
    if ((exec as { name?: string } | null)?.name) executiveName = (exec as { name: string }).name;
  }
  return {
    name: (lead as { name: string }).name,
    email: (lead as { email: string | null }).email ?? null,
    executiveId,
    executiveName,
  };
}

export type FollowUpSyncItem = {
  externalId: string;
  stageKey: string | null;
  followUp: unknown;
};

export type FollowUpSyncSummary = {
  created: number;
  updated: number;
  cancelled: number;
  unchanged: number;
  ignored: number;
  errors: string[];
};

/**
 * Aplica a decisão pura a UM lead. Idempotente: a mesma entrada
 * produz o mesmo estado e não duplica nada (identidade externa única).
 */
export async function syncOneFollowUp(
  item: FollowUpSyncItem,
  nowIso = new Date().toISOString(),
): Promise<FollowUpSyncDecision> {
  const leadId = `gs_${item.externalId}`;
  const existing = await loadMirror(item.externalId);
  const decision = planFollowUpSync({
    stageKey: item.stageKey,
    followUp: item.followUp,
    existing: existing
      ? {
          scheduledAt: existing.scheduled_at,
          state: existing.follow_up_state,
          externalFollowUp: existing.external_follow_up,
        }
      : null,
    nowIso,
  });
  const rawFollowUp = item.followUp === null || item.followUp === undefined ? null : String(item.followUp).trim();
  const modality = followUpModality(item.stageKey);
  const topic = modality ? FOLLOW_UP_TOPIC[modality] : MIRROR_TOPIC;

  /**
   * MESMO compromisso, outra modalidade (AGENDAMENTOS ↔ VÍDEO): não
   * cancela nem recria — apenas atualiza o tópico do mesmo registro.
   */
  if (existing && modality && (existing.topic ?? "") !== topic) {
    await supabaseAdmin
      .from("portal_meetings")
      .update({
        topic,
        updated_at: nowIso,
        follow_up_history: history(existing, {
          at: nowIso,
          event: "modalidade_atualizada",
          state: existing.follow_up_state ?? FOLLOW_UP_STATES.pending,
          detail: `Modalidade do compromisso atualizada para ${modality}.`,
        }),
      } as never)
      .eq("id", existing.id);
    existing.topic = topic;
  }

  if (decision.kind === "create") {
    const identity = await loadLeadIdentity(leadId);
    if (!identity) return { kind: "ignore", reason: "Lead sem card operacional no Portal." };
    if (!identity.executiveId) {
      return { kind: "ignore", reason: "Lead sem executivo responsável — compromisso não espelhado." };
    }
    const row = {
      id: followUpMeetingId(item.externalId),
      investor_id: leadId,
      investor_name: identity.name,
      investor_email: identity.email,
      executive_id: identity.executiveId,
      executive_name: identity.executiveName,
      scheduled_at: decision.scheduledAt,
      duration_min: 30,
      status: "Agendada",
      topic,
      origin: "greensales",
      external_source: GREENSALES_SOURCE,
      external_ref: followUpExternalRef(item.externalId),
      external_follow_up: rawFollowUp,
      follow_up_state: FOLLOW_UP_STATES.pending,
      follow_up_state_at: nowIso,
      follow_up_review_due_at: null,
      follow_up_history: history(null, {
        at: nowIso,
        event: "espelhado",
        to: decision.scheduledAt,
        state: FOLLOW_UP_STATES.pending,
        detail: `follow_up "${rawFollowUp}" recebido do GreenSales.`,
      }),
    };
    /**
     * Identidade determinística do espelho (`gsfu_<id>`) é a CHAVE
     * PRIMÁRIA real da tabela — o índice parcial de origem/referência
     * externa não pode ser usado aqui. Duas sincronizações simultâneas:
     * a segunda vira no-op pelo `ignoreDuplicates`.
     */
    const { error } = await supabaseAdmin
      .from("portal_meetings")
      .upsert(row as never, { onConflict: "id", ignoreDuplicates: true });

    if (error) throw new Error(error.message);
    await appendTimeline({
      leadId,
      event: "agendamento_greensales_espelhado",
      reason: `${noteSubject(modality).created} — ${formatBr(decision.scheduledAt)}.`,
      at: nowIso,
    });
    await appendFollowUpNote({
      leadId,
      externalId: item.externalId,
      kind: "criado",
      at: decision.scheduledAt,
      body: `${noteSubject(modality).created} — ${formatBrFull(decision.scheduledAt)}`,
    });
    return decision;
  }

  if (decision.kind === "update" && existing) {
    const { error } = await supabaseAdmin
      .from("portal_meetings")
      .update({
        scheduled_at: decision.to,
        status: "Agendada",
        cancel_reason: null,
        external_follow_up: rawFollowUp,
        follow_up_state: FOLLOW_UP_STATES.pending,
        follow_up_state_at: nowIso,
        follow_up_review_due_at: null,
        follow_up_review_resolved_at: null,
        updated_at: nowIso,
        follow_up_history: history(existing, {
          at: nowIso,
          event: "reagendado_na_origem",
          from: decision.from,
          to: decision.to,
          state: FOLLOW_UP_STATES.pending,
          detail: `follow_up atualizado no GreenSales para "${rawFollowUp}".`,
        }),
      } as never)
      .eq("id", existing.id)
      // Condicional: só aplica se ninguém alterou o horário no meio tempo.
      .eq("scheduled_at", existing.scheduled_at);
    if (error) throw new Error(error.message);
    await appendTimeline({
      leadId,
      event: "agendamento_greensales_atualizado",
      reason: `Reagendado no GreenSales: ${formatBr(decision.from)} → ${formatBr(decision.to)}.`,
      at: nowIso,
    });
    await appendFollowUpNote({
      leadId,
      externalId: item.externalId,
      kind: "reagendado",
      at: decision.to,
      body: `${noteSubject(modality).noun} reagendado — ${formatBrFull(decision.from)} → ${formatBrFull(decision.to)}`,
    });
    return decision;
  }

  if (decision.kind === "cancel" && existing) {
    const { error } = await supabaseAdmin
      .from("portal_meetings")
      .update({
        status: "Cancelada",
        cancel_reason: decision.detail,
        follow_up_state: decision.reason,
        follow_up_state_at: nowIso,
        follow_up_review_due_at: null,
        updated_at: nowIso,
        follow_up_history: history(existing, {
          at: nowIso,
          event: "cancelado",
          state: decision.reason,
          detail: decision.detail,
        }),
      } as never)
      .eq("id", existing.id)
      .eq("follow_up_state", existing.follow_up_state ?? "");
    if (error) throw new Error(error.message);
    await appendTimeline({
      leadId,
      event: "agendamento_greensales_cancelado",
      reason: decision.detail,
      at: nowIso,
    });
    await appendFollowUpNote({
      leadId,
      externalId: item.externalId,
      kind: "cancelado",
      at: existing.scheduled_at,
      body: `${noteSubject(followUpModality(existing.topic === FOLLOW_UP_TOPIC.VIDEOCHAMADA ? VIDEO_STAGE : AGENDAMENTOS_STAGE)).cancelled} — ${formatBrFull(existing.scheduled_at)}`,
    });
    return decision;
  }

  return decision;
}

/**
 * Sincronização em lote chamada ao fim de cada `runLeadSync`.
 * `overrides` traz o follow_up mais recente visto na listagem da origem
 * (prevalece sobre o `raw_payload` armazenado, que pode estar defasado
 * para leads não reprocessados nesta rodada).
 */
export async function syncGreenSalesFollowUps(
  overrides: Map<string, unknown>,
  nowIso = new Date().toISOString(),
): Promise<FollowUpSyncSummary> {
  const summary: FollowUpSyncSummary = {
    created: 0,
    updated: 0,
    cancelled: 0,
    unchanged: 0,
    ignored: 0,
    errors: [],
  };

  const [{ data: inStage }, { data: pendingMirrors }] = await Promise.all([
    supabaseAdmin
      .from("crm_leads")
      .select("external_id,stage_key,raw_payload")
      .eq("external_source", GREENSALES_SOURCE)
      .in("stage_key", FOLLOW_UP_ELIGIBLE_STAGES)
      .limit(2000),
    supabaseAdmin
      .from("portal_meetings")
      .select("external_ref,investor_id")
      .eq("external_source", GREENSALES_SOURCE)
      .in("follow_up_state", [FOLLOW_UP_STATES.pending, FOLLOW_UP_STATES.awaitingReschedule])
      .limit(2000),
  ]);

  const items = new Map<string, FollowUpSyncItem>();
  for (const row of (inStage ?? []) as { external_id: string; stage_key: string | null; raw_payload: unknown }[]) {
    const raw = (row.raw_payload ?? {}) as Record<string, unknown>;
    items.set(row.external_id, {
      externalId: row.external_id,
      stageKey: row.stage_key,
      followUp: overrides.has(row.external_id) ? overrides.get(row.external_id) : raw["follow_up"],
    });
  }
  // Espelhos pendentes cujo lead saiu de AGENDAMENTOS precisam ser vistos.
  const missing = ((pendingMirrors ?? []) as { investor_id: string }[])
    .map((m) => m.investor_id.replace(/^gs_/, ""))
    .filter((id) => !items.has(id));
  if (missing.length) {
    const { data: rows } = await supabaseAdmin
      .from("crm_leads")
      .select("external_id,stage_key,raw_payload")
      .eq("external_source", GREENSALES_SOURCE)
      .in("external_id", missing);
    for (const row of (rows ?? []) as { external_id: string; stage_key: string | null; raw_payload: unknown }[]) {
      const raw = (row.raw_payload ?? {}) as Record<string, unknown>;
      items.set(row.external_id, {
        externalId: row.external_id,
        stageKey: row.stage_key,
        followUp: overrides.has(row.external_id) ? overrides.get(row.external_id) : raw["follow_up"],
      });
    }
  }

  for (const item of items.values()) {
    try {
      const decision = await syncOneFollowUp(item, nowIso);
      if (decision.kind === "create") summary.created += 1;
      else if (decision.kind === "update") summary.updated += 1;
      else if (decision.kind === "cancel") summary.cancelled += 1;
      else if (decision.kind === "noop") summary.unchanged += 1;
      else summary.ignored += 1;
    } catch (error) {
      summary.errors.push(
        `Follow-up ${item.externalId}: ${error instanceof Error ? error.message : "falha desconhecida"}`,
      );
    }
  }
  return summary;
}

/* ------------------------------------------------------------------ */
/*  AÇÃO DO DIA — desfechos humanos                                    */
/* ------------------------------------------------------------------ */

async function loadMirrorById(meetingId: string): Promise<MirrorRow | null> {
  const { data } = await supabaseAdmin
    .from("portal_meetings")
    .select(
      "id,investor_id,executive_id,scheduled_at,status,external_follow_up,follow_up_state,follow_up_review_due_at,follow_up_history",
    )
    .eq("id", meetingId)
    .eq("external_source", GREENSALES_SOURCE)
    .maybeSingle();
  return (data as MirrorRow | null) ?? null;
}

/** Transição condicional de estado — só aplica a partir do estado esperado. */
async function transition(input: {
  meeting: MirrorRow;
  expected: string[];
  next: string;
  status?: string;
  reviewDueAt?: string | null;
  reviewResolvedAt?: string | null;
  entry: HistoryEntry;
  nowIso: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!input.expected.includes(input.meeting.follow_up_state ?? "")) {
    return { ok: false, reason: `Estado atual (${input.meeting.follow_up_state ?? "—"}) não permite esta ação.` };
  }
  const patch: Record<string, unknown> = {
    follow_up_state: input.next,
    follow_up_state_at: input.nowIso,
    updated_at: input.nowIso,
    follow_up_history: history(input.meeting, input.entry),
  };
  if (input.status) patch["status"] = input.status;
  if (input.reviewDueAt !== undefined) patch["follow_up_review_due_at"] = input.reviewDueAt;
  if (input.reviewResolvedAt !== undefined) patch["follow_up_review_resolved_at"] = input.reviewResolvedAt;
  const { data, error } = await supabaseAdmin
    .from("portal_meetings")
    .update(patch as never)
    .eq("id", input.meeting.id)
    .eq("follow_up_state", input.meeting.follow_up_state ?? "")
    .select("id");
  if (error) return { ok: false, reason: error.message };
  if (!data || data.length === 0) return { ok: false, reason: "Ação já registrada por outra sessão." };
  return { ok: true };
}

/** "Houve contato de agendamento?" → SIM. Encerra a obrigação. */
export async function registerFollowUpContact(input: {
  meetingId: string;
  actorId?: string | null;
  note?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const meeting = await loadMirrorById(input.meetingId);
  if (!meeting) return { ok: false, reason: "Compromisso do GreenSales não encontrado." };
  const nowIso = new Date().toISOString();
  const result = await transition({
    meeting,
    expected: [FOLLOW_UP_STATES.pending, FOLLOW_UP_STATES.expiredNoContact],
    next: FOLLOW_UP_STATES.contacted,
    status: "Concluída",
    reviewDueAt: null,
    entry: { at: nowIso, event: "contato_realizado", state: FOLLOW_UP_STATES.contacted, detail: input.note ?? null, actor_id: input.actorId ?? null },
    nowIso,
  });
  if (result.ok) {
    await appendTimeline({
      leadId: meeting.investor_id,
      event: "agendamento_contato_realizado",
      reason: input.note?.trim() || "Contato de agendamento realizado.",
      actorId: input.actorId ?? null,
      at: nowIso,
    });
  }
  return result;
}

/**
 * "Houve contato de agendamento?" → NÃO.
 *  - reagendar = SIM → aguarda atualização no GreenSales (Portal espelha);
 *  - reagendar = NÃO → vencido sem contato; obrigação de 24h programada.
 */
export async function registerFollowUpNoContact(input: {
  meetingId: string;
  willReschedule: boolean;
  actorId?: string | null;
  note?: string | null;
}): Promise<{ ok: boolean; reason?: string; reviewDueAt?: string | null }> {
  const meeting = await loadMirrorById(input.meetingId);
  if (!meeting) return { ok: false, reason: "Compromisso do GreenSales não encontrado." };
  const nowIso = new Date().toISOString();
  if (input.willReschedule) {
    const result = await transition({
      meeting,
      expected: [FOLLOW_UP_STATES.pending, FOLLOW_UP_STATES.expiredNoContact],
      next: FOLLOW_UP_STATES.awaitingReschedule,
      reviewDueAt: null,
      entry: { at: nowIso, event: "sem_contato_vai_reagendar", state: FOLLOW_UP_STATES.awaitingReschedule, detail: input.note ?? null, actor_id: input.actorId ?? null },
      nowIso,
    });
    if (result.ok) {
      await appendTimeline({
        leadId: meeting.investor_id,
        event: "agendamento_sem_contato_reagendar",
        reason: "Sem contato — executivo vai reagendar no GreenSales.",
        actorId: input.actorId ?? null,
        at: nowIso,
      });
    }
    return result;
  }
  const dueAt = reviewDueAt(nowIso);
  const result = await transition({
    meeting,
    expected: [FOLLOW_UP_STATES.pending],
    next: FOLLOW_UP_STATES.expiredNoContact,
    reviewDueAt: dueAt,
    entry: { at: nowIso, event: "sem_contato_sem_reagendamento", state: FOLLOW_UP_STATES.expiredNoContact, detail: input.note ?? null, actor_id: input.actorId ?? null },
    nowIso,
  });
  if (result.ok) {
    await appendTimeline({
      leadId: meeting.investor_id,
      event: "agendamento_vencido_sem_contato",
      reason: "Sem contato e sem reagendamento — verificação em 24h programada.",
      actorId: input.actorId ?? null,
      at: nowIso,
    });
  }
  return { ...result, reviewDueAt: dueAt };
}

/**
 * Obrigação de 24h: "Deseja encerrar esse fluxo?"
 *  - encerrar = SIM → ENCERRADO (nenhuma nova ação);
 *  - encerrar = NÃO → RETOMAR_EM_FRIOS (orientação: mover para Frios no
 *    GreenSales; a liberação do R acontece só na transição estruturada).
 */
export async function resolveFollowUpReview(input: {
  meetingId: string;
  close: boolean;
  actorId?: string | null;
  note?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const meeting = await loadMirrorById(input.meetingId);
  if (!meeting) return { ok: false, reason: "Compromisso do GreenSales não encontrado." };
  const nowIso = new Date().toISOString();
  const next = input.close ? FOLLOW_UP_STATES.closed : FOLLOW_UP_STATES.resumeInFrios;
  const result = await transition({
    meeting,
    expected: [FOLLOW_UP_STATES.expiredNoContact],
    next,
    status: input.close ? "Concluída" : undefined,
    reviewResolvedAt: nowIso,
    entry: { at: nowIso, event: input.close ? "fluxo_encerrado" : "retomar_em_frios", state: next, detail: input.note ?? null, actor_id: input.actorId ?? null },
    nowIso,
  });
  if (result.ok) {
    await appendTimeline({
      leadId: meeting.investor_id,
      event: input.close ? "agendamento_fluxo_encerrado" : "agendamento_retomar_em_frios",
      reason: input.close
        ? "Fluxo de agendamento encerrado pelo executivo."
        : "Executivo optou por retomar o relacionamento — mover para Frios no GreenSales.",
      actorId: input.actorId ?? null,
      at: nowIso,
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  AGENDAMENTOS → FRIOS — liberação do R                              */
/* ------------------------------------------------------------------ */

/**
 * Detecta a transição ESTRUTURADA de estágio (feita no GreenSales pelo
 * executivo) e libera o reengajamento UMA única vez por transição:
 * abre nova instância `reengajamento` já ativa para o motor V2
 * (`canStartReengagement`) programar o R1. Sem tag, sem texto, sem
 * mensagem automática.
 */
export async function releaseReengagementOnFrios(input: {
  externalId: string;
  previousStageKey: string | null;
  currentStageKey: string | null;
  stageEnteredAt?: string | null;
}): Promise<{ released: boolean; reason: string }> {
  // VÍDEO → FRIOS é equivalente a AGENDAMENTOS → FRIOS: mesma regra,
  // mesmo motor, mesma fila — só a etapa de origem foi ampliada.
  if (!isCommitmentStageToFrios(input.previousStageKey, input.currentStageKey)) {
    return { released: false, reason: "Não é a transição de compromisso (AGENDAMENTOS/VÍDEO) → FRIOS." };
  }
  const leadId = `gs_${input.externalId}`;
  const at = input.stageEnteredAt ?? new Date().toISOString();
  const eventKey = `r_release_${leadId}_${at}`;
  const first = await appendRelationshipEvent({
    leadId,
    eventKey,
    type: "REENGAGEMENT_RELEASED",
    step: "R1",
    at,
    data: { from: input.previousStageKey, to: input.currentStageKey, source: GREENSALES_SOURCE },
  });
  if (!first) return { released: false, reason: "Liberação já registrada para esta transição." };

  /**
   * DECISÃO HISTÓRICA — o R é consumido UMA vez por rodada de
   * relacionamento. Antes de abrir a instância, o histórico REAL do
   * lead (instâncias + fila já existentes) responde se ainda existe R
   * a cumprir. Um R apenas iniciado e interrompido não bloqueia.
   */
  const [{ evaluateReengagementConsumption }, { listInstances }] = await Promise.all([
    import("@/lib/relationship/reengagement-history"),
    import("@/server/relationship/instances.server"),
  ]);
  const [instances, { data: queueRows }] = await Promise.all([
    listInstances(leadId, "production"),
    supabaseAdmin
      .from("relationship_queue")
      .select("flow,step,status")
      .eq("scope", SCOPE)
      .eq("lead_id", leadId),
  ]);
  const { data: instanceRows } = await supabaseAdmin
    .from("relationship_cadences")
    .select("flow,active,close_reason,executed_steps")
    .eq("scope", SCOPE)
    .eq("lead_id", leadId);
  const consumption = evaluateReengagementConsumption({
    instances: ((instanceRows ?? []) as Record<string, unknown>[]).map((row) => ({
      flow: String(row["flow"] ?? ""),
      active: Boolean(row["active"]),
      closeReason: (row["close_reason"] as string | null) ?? null,
      executedSteps: Array.isArray(row["executed_steps"])
        ? (row["executed_steps"] as unknown[]).map(String)
        : [],
    })),
    queue: ((queueRows ?? []) as Record<string, unknown>[]).map((row) => ({
      flow: (row["flow"] as string | null) ?? null,
      step: String(row["step"] ?? ""),
      status: String(row["status"] ?? ""),
    })),
  });
  if (consumption.consumed) {
    // Nada é apagado, cancelado ou reescrito: apenas não nasce outro R.
    await appendTimeline({
      leadId,
      event: "reengajamento_nao_liberado",
      reason: consumption.reason,
      at,
    });
    return { released: false, reason: consumption.reason };
  }
  void instances;

  const { openInstance } = await import("@/server/relationship/instances.server");
  const opened = await openInstance({
    leadId,
    openedReason: "agendamentos_para_frios",
    closeReason: "encerrada_por_reengajamento",
    flow: "reengajamento",
    stageKey: input.currentStageKey,
    startedBy: "greensales_stage_transition",
  });
  if (!opened.opened) return { released: false, reason: opened.reason };

  // Instância nasce ATIVA e carimbada como operacional: o tick do motor
  // avalia e a V2 decide o R1 — nenhuma ação é executada aqui.
  await supabaseAdmin
    .from("relationship_cadences")
    .update({
      state: "CADENCE_ACTIVE",
      operational_since: at,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", opened.id);

  // Pendências do ciclo E anterior perderam finalidade: ficam CANCELADAS
  // (registradas, nunca apagadas) para que só a régua R siga.
  await supabaseAdmin
    .from("relationship_queue")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() } as never)
    .eq("scope", SCOPE)
    .eq("lead_id", leadId)
    .eq("status", "PENDING")
    .neq("flow", "reengajamento");

  // Espelho do agendamento, se ainda pendente, fica registrado como
  // retomado em Frios (não é cancelado pela origem).
  const mirror = await loadMirror(input.externalId);
  if (mirror && [FOLLOW_UP_STATES.pending, FOLLOW_UP_STATES.expiredNoContact].includes(mirror.follow_up_state as never)) {
    await transition({
      meeting: mirror,
      expected: [mirror.follow_up_state ?? ""],
      next: FOLLOW_UP_STATES.resumeInFrios,
      status: "Cancelada",
      reviewDueAt: null,
      entry: { at, event: "movido_para_frios", state: FOLLOW_UP_STATES.resumeInFrios, detail: "Lead movido de AGENDAMENTOS para FRIOS no GreenSales." },
      nowIso: at,
    });
  }

  await appendTimeline({
    leadId,
    event: "reengajamento_liberado",
    reason: "Lead saiu de AGENDAMENTOS para FRIOS — reengajamento (R1) liberado para a régua.",
    at,
  });
  return { released: true, reason: "Reengajamento liberado." };
}
