/**
 * Repositório do MOTOR DE RELACIONAMENTO — SERVER ONLY.
 *
 * Cada instância nasce presa a um escopo (`production` ou
 * `homologation`) e a uma rodada. Nenhuma consulta jamais atravessa
 * escopos: é essa fronteira que impede um evento fictício de alterar um
 * lead real (COMANDO 1B §12).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EngineRepository } from "@/lib/relationship/ports";
import type { TemplateResolver } from "@/lib/relationship/templates";
import { initialRecord } from "@/lib/relationship/machine";
import { getPublishedVersion } from "./flow-versions.server";
import { belongsToReentryCycle, reentryInternalOrder, reentryQueueOrder } from "@/lib/relationship/reentry-cycle";
import type {
  CadenceRecord,
  CadenceStep,
  EngineDecision,
  EngineEvent,
  EngineScope,
  QueueItem,
} from "@/lib/relationship/types";
import { envNow } from "@/server/time/environment-clock.server";

type Row = Record<string, any>;

function toRecord(row: Row): CadenceRecord {
  return {
    scope: row.scope,
    leadId: row.lead_id,
    runId: row.run_id ?? null,
    state: row.state,
    previousState: row.previous_state ?? null,
    flow: row.flow,
    flowVersionId: row.flow_version_id ?? null,
    flowVersion: row.flow_version ?? null,
    currentStep: row.current_step ?? null,
    executedSteps: (row.executed_steps ?? []) as CadenceStep[],
    startedAt: row.started_at ?? null,
    operationalSince: row.operational_since ?? null,
    startedBy: row.started_by ?? null,
    lastEventType: row.last_event_type ?? null,
    lastEventAt: row.last_event_at ?? null,
    lastOutboundAt: row.last_outbound_at ?? null,
    lastInboundAt: row.last_inbound_at ?? null,
    lastExecutiveReplyAt: row.last_executive_reply_at ?? null,
    windowOpenUntil: row.window_open_until ?? null,
    readCount: row.read_count ?? 0,
    responseCount: row.response_count ?? 0,
    scheduled: Boolean(row.scheduled),
    nameConfirmed: Boolean(row.name_confirmed),
    contentHistory: (row.content_history ?? []) as string[],
    openingTemplateHistory: (row.opening_template_history ?? []) as string[],
    closedAt: row.closed_at ?? null,
    closeReason: row.close_reason ?? null,
    updatedAt: row.updated_at ?? envNow().toISOString(),
  };
}

function toQueueItem(row: Row): QueueItem {
  return {
    id: row.id,
    scope: row.scope,
    runId: row.run_id ?? null,
    leadId: row.lead_id,
    flow: row.flow,
    step: row.step,
    dueAt: row.due_at,
    priority: row.priority ?? 5,
    status: row.status,
    attempts: row.attempts ?? 0,
    executedAt: row.executed_at ?? null,
    result: row.result ?? null,
    reason: row.reason ?? null,
    flowVersionId: row.flow_version_id ?? null,
    actionOrder: row.action_order == null ? null : reentryInternalOrder(row.step, row.action_order),
    actionKind: (row.action_kind ?? null) as "call" | "message" | "manual" | null,
    theoreticalDate: row.theoretical_date ?? null,
    originDate: row.origin_date ?? null,
    cancelReason: row.cancel_reason ?? null,
  };
}

export function createRepository(scope: EngineScope, runId: string | null = null): EngineRepository {
  const scoped = <T extends { eq: (c: string, v: any) => T; is: (c: string, v: any) => T }>(q: T) =>
    (runId ? q.eq("scope", scope).eq("run_id", runId) : q.eq("scope", scope).is("run_id", null)) as T;
  const loadedCycles = new Map<string, { id: string; sequence: number | null }>();
  const activeReentrySequence = async (leadId: string): Promise<number | null> => {
    if (scope !== "production" || runId) return null;
    const loaded = loadedCycles.get(leadId);
    if (loaded) return loaded.sequence;
    const { data, error } = await scoped(supabaseAdmin.from("relationship_cadences").select("instance_seq,opened_reason,flow") as any)
      .eq("lead_id", leadId).eq("active", true).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.flow === "reentrada" && data?.opened_reason?.startsWith("reentry:") ? data.instance_seq : null;
  };

  return {
    scope,
    runId,

    /**
     * INSTÂNCIAS DE CADÊNCIA: um lead pode ter várias jornadas ao longo
     * do tempo. O motor sempre trabalha sobre a instância ATIVA; as
     * anteriores ficam intactas, apenas com `active = false`.
     */
    async loadRecord(leadId) {
      const { data } = await scoped(
        supabaseAdmin.from("relationship_cadences").select("*") as any,
      )
        .eq("lead_id", leadId)
        .eq("active", true)
        .order("instance_seq", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) loadedCycles.set(leadId, { id: data.id, sequence: data.flow === "reentrada" && data.opened_reason?.startsWith("reentry:") ? data.instance_seq : null });
      else loadedCycles.delete(leadId);
      return data ? toRecord(data) : null;
    },

    async saveRecord(record) {
      if (record.scope !== scope || (record.runId ?? null) !== runId) {
        throw new Error(
          "Registro de outro ambiente/rodada não pode ser gravado por este repositório.",
        );
      }
      const payload = {
        scope,
        run_id: runId,
        lead_id: record.leadId,
        state: record.state,
        previous_state: record.previousState,
        flow: record.flow,
        current_step: record.currentStep,
        executed_steps: record.executedSteps,
        started_at: record.startedAt,
        // Ciclo legado permanece sem carimbo: nunca é preenchido retroativamente.
        operational_since: record.operationalSince,
        started_by: record.startedBy,
        last_event_type: record.lastEventType,
        last_event_at: record.lastEventAt,
        last_outbound_at: record.lastOutboundAt,
        last_inbound_at: record.lastInboundAt,
        last_executive_reply_at: record.lastExecutiveReplyAt,
        window_open_until: record.windowOpenUntil,
        read_count: record.readCount,
        response_count: record.responseCount,
        scheduled: record.scheduled,
        name_confirmed: record.nameConfirmed,
        content_history: record.contentHistory,
        opening_template_history: record.openingTemplateHistory,
        closed_at: record.closedAt,
        close_reason: record.closeReason,
        // O relógio do motor já está materializado no snapshot. Em
        // homologação acelerada ele precisa prevalecer sobre o relógio
        // físico do servidor; produção continua usando o instante real.
        updated_at: record.updatedAt,
      };
      // Atualiza a instância ativa; se não houver, abre a instância 1.
      const { data: current } = await scoped(
        supabaseAdmin.from("relationship_cadences").select("id") as any,
      )
        .eq("lead_id", record.leadId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (current?.id) {
        const loaded = loadedCycles.get(record.leadId);
        if (loaded && loaded.id !== current.id) throw new Error("Ciclo substituído por nova entrada comercial.");
        const { data: saved, error } = await supabaseAdmin
          .from("relationship_cadences")
          .update(payload as any)
          .eq("id", current.id).eq("active", true).select("id");
        if (error) throw new Error(error.message);
        if (!saved?.length) throw new Error("Ciclo substituído por nova entrada comercial.");
        return;
      }
      /**
       * BLOCO 4 §4 — NASCIMENTO DO CICLO: a versão PUBLICADA do fluxo é
       * congelada aqui, uma única vez. Nenhuma atualização posterior
       * altera esta versão; publicar uma versão nova vale apenas para
       * ciclos futuros.
       */
      const published = await getPublishedVersion(record.flow).catch(() => null);
      await supabaseAdmin.from("relationship_cadences").insert({
        ...payload,
        instance_seq: 1,
        active: true,
        flow_version_id: published?.id ?? null,
        flow_version: published?.version ?? null,
      } as any);
    },

    /** Idempotência: a mesma chave de evento nunca produz dois efeitos. */
    async registerEvent(event: EngineEvent) {
      if (event.scope !== scope) {
        throw new Error("Evento de outro ambiente não pode ser registrado por este repositório.");
      }
      // Chaves legadas de conclusão RE eram por lead/etapa, não por nova submissão.
      // Somente esses eventos ganham vínculo ao ciclo; o histórico anterior é intocado.
      const reentryCompletion = /:RE[0-3]:(sent|completed)$/.test(event.id);
      const sequence = reentryCompletion ? await activeReentrySequence(event.leadId) : null;
      const { error } = await supabaseAdmin.from("relationship_events").insert({
        scope,
        run_id: runId,
        lead_id: event.leadId,
        event_key: sequence === null ? event.id : `${event.id}:cycle:${sequence}`,
        type: event.type,
        step: event.step ?? null,
        template_id: event.templateId ?? null,
        content_id: event.contentId ?? null,
        historical: Boolean(event.historical),
        occurred_at: event.at,
        data: (event.data ?? {}) as any,
      } as any);
      if (!error) return true;
      if (error.code === "23505") return false; // evento repetido
      throw new Error(error.message);
    },

    async loadQueue(leadId) {
      const sequence = await activeReentrySequence(leadId);
      const { data } = await scoped(supabaseAdmin.from("relationship_queue").select("*") as any)
        .eq("lead_id", leadId)
        .order("due_at", { ascending: true });
      return (data ?? []).filter((row: Row) => sequence === null || belongsToReentryCycle(row.step, row.action_order ?? 1, sequence)).map(toQueueItem);
    },

    async upsertQueueItem(item) {
      if (item.scope !== scope || (item.runId ?? null) !== runId) {
        throw new Error("Tarefa de outro ambiente/rodada não pode entrar nesta fila.");
      }
      const sequence = /^RE[0-3]$/.test(item.step) ? await activeReentrySequence(item.leadId) : null;
      const loaded = loadedCycles.get(item.leadId);
      if (loaded?.sequence != null) {
        const { data: active } = await scoped(supabaseAdmin.from("relationship_cadences").select("id") as any)
          .eq("lead_id", item.leadId).eq("active", true).maybeSingle();
        if (active?.id !== loaded.id) throw new Error("Ciclo substituído por nova entrada comercial.");
      }
      const payload = {
        scope,
        run_id: runId,
        lead_id: item.leadId,
        flow: item.flow,
        step: item.step,
        due_at: item.dueAt,
        priority: item.priority,
        status: item.status,
        attempts: item.attempts,
        executed_at: item.executedAt,
        result: item.result,
        reason: item.reason,
        // Versão herdada do ciclo: a ação pendente continua explicável.
        flow_version_id: item.flowVersionId ?? null,
        // RÉGUA V2: ação interna, data teórica e origem do ciclo.
        action_order: sequence === null ? (item.actionOrder ?? 1) : reentryQueueOrder(sequence, item.actionOrder ?? 1),
        action_kind: item.actionKind ?? null,
        theoretical_date: item.theoreticalDate ?? null,
        origin_date: item.originDate ?? null,
        // Reagendar uma linha antes neutralizada limpa o motivo antigo.
        cancel_reason: item.cancelReason ?? null,
        updated_at: envNow().toISOString(),
      };
      const additionalCall = (item.step === "E1" && item.actionOrder === 2 || item.step === "E2" && item.actionOrder === 3) && item.actionKind === "call";
      const { data, error } = await supabaseAdmin
        .from("relationship_queue")
        .upsert(payload as any, { onConflict: "scope,run_id,lead_id,step,action_order", ignoreDuplicates: additionalCall && !item.id })
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        const existing = (await this.loadQueue(item.leadId)).find((q) => q.step === item.step && q.actionOrder === item.actionOrder);
        if (existing) return existing;
        throw new Error("Tentativa adicional não encontrada após gravação.");
      }
      return toQueueItem(data as Row);
    },

    /**
     * Reserva atômica: o UPDATE condicional só afeta a linha que ainda
     * estiver PENDING. Dois workers simultâneos ⇒ uma única execução.
     */
    async claimQueueItem(id) {
      const { data } = await supabaseAdmin
        .from("relationship_queue")
        .update({ status: "PROCESSING", updated_at: envNow().toISOString() } as any)
        .eq("id", id)
        .eq("scope", scope)
        .eq("status", "PENDING")
        .select("id");
      return (data ?? []).length > 0;
    },

    async updateQueueItem(id, patch) {
      const update: Row = { updated_at: envNow().toISOString() };
      if (patch.status !== undefined) update["status"] = patch.status;
      if (patch.attempts !== undefined) update["attempts"] = patch.attempts;
      if (patch.executedAt !== undefined) update["executed_at"] = patch.executedAt;
      if (patch.result !== undefined) update["result"] = patch.result;
      if (patch.reason !== undefined) update["reason"] = patch.reason;
      if (patch.cancelReason !== undefined) update["cancel_reason"] = patch.cancelReason;
      const query = supabaseAdmin
        .from("relationship_queue")
        .update(update as any)
        .eq("id", id)
        .eq("scope", scope);
      // Expiração nunca sobrescreve execução concorrente nem outro desfecho.
      if (patch.cancelReason === "additional_call_day_expired") {
        await query.in("status", ["PENDING", "PROCESSING"]);
      } else {
        await query;
      }
    },

    /** Resposta, agendamento e encerramento sempre vencem o timer. */
    async cancelPendingItems(leadId, reason) {
      const { data } = await scoped(
        supabaseAdmin
          .from("relationship_queue")
          .update({
            status: "CANCELLED",
            reason,
            cancel_reason: reason,
            updated_at: envNow().toISOString(),
          } as any)
          .in("status", ["PENDING", "PROCESSING"])
          .select("id") as any,
      ).eq("lead_id", leadId);
      return (data ?? []).length;
    },

    async recordDecision(decision: EngineDecision) {
      await supabaseAdmin.from("relationship_decisions").insert({
        scope,
        run_id: runId,
        lead_id: decision.leadId,
        decided_at: decision.at,
        step: decision.step,
        flow: decision.flow,
        state_before: decision.stateBefore,
        state_after: decision.stateAfter,
        outcome: decision.outcome,
        reason: decision.reason,
        template_id: decision.templateId ?? null,
        template_version: decision.templateVersion ?? null,
        content_id: decision.contentId ?? null,
        error: decision.error ?? null,
      } as any);
    },

    async loadTemplates(): Promise<TemplateResolver> {
      const { data } = await supabaseAdmin
        .from("relationship_template_bindings")
        .select("purpose,template_id,meta_id,version,approved,updated_at")
        .eq("scope", scope);
      return {
        bindings: (data ?? []).map((row: Row) => ({
          purpose: row.purpose,
          templateId: row.template_id ?? null,
          metaId: row.meta_id ?? null,
          version: row.version ?? 1,
          approved: Boolean(row.approved),
          updatedAt: row.updated_at ?? null,
        })),
      };
    },

  };
}

/** Registro inicial em memória — usado por leituras que ainda não persistiram. */
export function emptyRecord(scope: EngineScope, leadId: string, runId: string | null) {
  return initialRecord({ scope, leadId, runId, at: envNow().toISOString() });
}