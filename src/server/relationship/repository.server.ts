/**
 * Repositório do MOTOR DE RELACIONAMENTO — SERVER ONLY.
 *
 * Cada instância nasce presa a um escopo (`production` ou
 * `homologation`) e a uma rodada. Nenhuma consulta jamais atravessa
 * escopos: é essa fronteira que impede um evento fictício de alterar um
 * lead real (COMANDO 1B §12).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ValueContent } from "@/lib/relationship/content";
import type { EngineRepository } from "@/lib/relationship/ports";
import type { TemplateResolver } from "@/lib/relationship/templates";
import { initialRecord } from "@/lib/relationship/machine";
import type {
  CadenceRecord,
  CadenceStep,
  EngineDecision,
  EngineEvent,
  EngineScope,
  QueueItem,
} from "@/lib/relationship/types";

type Row = Record<string, any>;

function toRecord(row: Row): CadenceRecord {
  return {
    scope: row.scope,
    leadId: row.lead_id,
    runId: row.run_id ?? null,
    state: row.state,
    previousState: row.previous_state ?? null,
    flow: row.flow,
    currentStep: row.current_step ?? null,
    executedSteps: (row.executed_steps ?? []) as CadenceStep[],
    startedAt: row.started_at ?? null,
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
    updatedAt: row.updated_at ?? new Date().toISOString(),
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
  };
}

export function createRepository(scope: EngineScope, runId: string | null = null): EngineRepository {
  const scoped = <T extends { eq: (c: string, v: any) => T; is: (c: string, v: any) => T }>(q: T) =>
    (runId ? q.eq("scope", scope).eq("run_id", runId) : q.eq("scope", scope).is("run_id", null)) as T;

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
        updated_at: new Date().toISOString(),
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
        await supabaseAdmin
          .from("relationship_cadences")
          .update(payload as any)
          .eq("id", current.id);
        return;
      }
      await supabaseAdmin
        .from("relationship_cadences")
        .insert({ ...payload, instance_seq: 1, active: true } as any);
    },

    /** Idempotência: a mesma chave de evento nunca produz dois efeitos. */
    async registerEvent(event: EngineEvent) {
      if (event.scope !== scope) {
        throw new Error("Evento de outro ambiente não pode ser registrado por este repositório.");
      }
      const { error } = await supabaseAdmin.from("relationship_events").insert({
        scope,
        run_id: runId,
        lead_id: event.leadId,
        event_key: event.id,
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
      const { data } = await scoped(supabaseAdmin.from("relationship_queue").select("*") as any)
        .eq("lead_id", leadId)
        .order("due_at", { ascending: true });
      return (data ?? []).map(toQueueItem);
    },

    async upsertQueueItem(item) {
      if (item.scope !== scope || (item.runId ?? null) !== runId) {
        throw new Error("Tarefa de outro ambiente/rodada não pode entrar nesta fila.");
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
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabaseAdmin
        .from("relationship_queue")
        .upsert(payload as any, { onConflict: "scope,run_id,lead_id,step" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toQueueItem(data as Row);
    },

    /**
     * Reserva atômica: o UPDATE condicional só afeta a linha que ainda
     * estiver PENDING. Dois workers simultâneos ⇒ uma única execução.
     */
    async claimQueueItem(id) {
      const { data } = await supabaseAdmin
        .from("relationship_queue")
        .update({ status: "PROCESSING", updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .eq("scope", scope)
        .eq("status", "PENDING")
        .select("id");
      return (data ?? []).length > 0;
    },

    async updateQueueItem(id, patch) {
      const update: Row = { updated_at: new Date().toISOString() };
      if (patch.status !== undefined) update["status"] = patch.status;
      if (patch.attempts !== undefined) update["attempts"] = patch.attempts;
      if (patch.executedAt !== undefined) update["executed_at"] = patch.executedAt;
      if (patch.result !== undefined) update["result"] = patch.result;
      if (patch.reason !== undefined) update["reason"] = patch.reason;
      await supabaseAdmin
        .from("relationship_queue")
        .update(update as any)
        .eq("id", id)
        .eq("scope", scope);
    },

    /** Resposta, agendamento e encerramento sempre vencem o timer. */
    async cancelPendingItems(leadId, reason) {
      const { data } = await scoped(
        supabaseAdmin
          .from("relationship_queue")
          .update({ status: "CANCELLED", reason, updated_at: new Date().toISOString() } as any)
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

    async loadContentLibrary(): Promise<ValueContent[]> {
      // A Biblioteca de Conteúdos é PERMANENTE e única (COMANDO 3C §16):
      // homologação e operação real leem exatamente o mesmo acervo.
      const { listValueContents } = await import("./homologation.server");
      return listValueContents();
    },

    async loadStepContentBindings(): Promise<Record<string, string>> {
      // Vínculo declarado etapa → conteúdo. Nunca inferido.
      const { loadStepContentBindings } = await import("./step-media.server");
      return loadStepContentBindings();
    },

    async loadStepContentPools(): Promise<Record<string, string[]>> {
      // Pool completo da etapa: um vínculo sai direto, vários rodam em
      // rotação determinística. Sem vínculo, nada é anexado.
      const { loadStepContentMap } = await import("./step-media.server");
      return loadStepContentMap();
    },
  };
}

/** Registro inicial em memória — usado por leituras que ainda não persistiram. */
export function emptyRecord(scope: EngineScope, leadId: string, runId: string | null) {
  return initialRecord({ scope, leadId, runId, at: new Date().toISOString() });
}