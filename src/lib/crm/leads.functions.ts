/**
 * Camada de acesso do CRM próprio (interface ↔ servidor).
 *
 * Toda leitura e ação exige sessão autenticada e papel de gestão. O
 * navegador nunca fala com a origem externa: apenas com o nosso servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CrmLeadView = {
  id: string;
  externalId: string;
  name: string;
  phone: string;
  email: string;
  origin: string | null;
  captureForm: string | null;
  pipelineName: string | null;
  stageKey: string | null;
  externalCreatedAt: string | null;
  ingestedAt: string;
  lastSyncedAt: string | null;
  syncStatus: string;
  syncError: string | null;
  welcomeStatus: string;
  welcomeSentAt: string | null;
  welcomeError: string | null;
  welcomeLink: string | null;
};

export type CrmLeadEventView = {
  id: string;
  type: string;
  message: string | null;
  createdAt: string;
};

export type CrmSyncRunView = {
  id: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  found: number;
  created: number;
  updated: number;
  failed: number;
  welcomeSent: number;
  welcomeFailed: number;
  message: string | null;
};

type LeadRow = {
  id: string;
  external_id: string;
  name: string;
  phone: string;
  email: string;
  origin: string | null;
  capture_form: string | null;
  pipeline_name: string | null;
  stage_key: string | null;
  external_created_at: string | null;
  ingested_at: string;
  last_synced_at: string | null;
  sync_status: string;
  sync_error: string | null;
  welcome_status: string;
  welcome_sent_at: string | null;
  welcome_error: string | null;
  welcome_link: string | null;
};

function toView(row: LeadRow): CrmLeadView {
  return {
    id: row.id,
    externalId: row.external_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    origin: row.origin,
    captureForm: row.capture_form,
    pipelineName: row.pipeline_name,
    stageKey: row.stage_key,
    externalCreatedAt: row.external_created_at,
    ingestedAt: row.ingested_at,
    lastSyncedAt: row.last_synced_at,
    syncStatus: row.sync_status,
    syncError: row.sync_error,
    welcomeStatus: row.welcome_status,
    welcomeSentAt: row.welcome_sent_at,
    welcomeError: row.welcome_error,
    welcomeLink: row.welcome_link,
  };
}

const LEAD_FIELDS =
  "id,external_id,name,phone,email,origin,capture_form,pipeline_name,stage_key,external_created_at,ingested_at,last_synced_at,sync_status,sync_error,welcome_status,welcome_sent_at,welcome_error,welcome_link";

async function assertManager(context: { supabase: never; userId: string }) {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>;
  };
  const [admin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!admin.data && !manager.data) throw new Error("Acesso restrito à gestão do CRM.");
}

/** Lista os leads do nosso CRM, com filtros de operação. */
export const listCrmLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        stageKey: z.string().optional(),
        search: z.string().optional(),
        welcomeStatus: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<CrmLeadView[]> => {
    await assertManager(context as never);
    let query = context.supabase
      .from("crm_leads")
      .select(LEAD_FIELDS)
      .order("external_created_at", { ascending: false })
      .limit(500);
    if (data.stageKey) query = query.eq("stage_key", data.stageKey);
    if (data.welcomeStatus) query = query.eq("welcome_status", data.welcomeStatus);
    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows as unknown as LeadRow[]).map(toView);
  });

/** Ficha completa: dados do lead e histórico de eventos. */
export const getCrmLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ lead: CrmLeadView | null; events: CrmLeadEventView[] }> => {
      await assertManager(context as never);
      const [lead, events] = await Promise.all([
        context.supabase.from("crm_leads").select(LEAD_FIELDS).eq("id", data.id).maybeSingle(),
        context.supabase
          .from("crm_lead_events")
          .select("id,type,message,created_at")
          .eq("lead_id", data.id)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (lead.error) throw new Error(lead.error.message);
      return {
        lead: lead.data ? toView(lead.data as unknown as LeadRow) : null,
        events: (events.data ?? []).map((e) => ({
          id: e.id,
          type: e.type,
          message: e.message,
          createdAt: e.created_at,
        })),
      };
    },
  );

/** Últimas execuções da sincronização — transparência operacional. */
export const listCrmSyncRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmSyncRunView[]> => {
    await assertManager(context as never);
    const { data, error } = await context.supabase
      .from("crm_sync_runs")
      .select(
        "id,trigger,status,started_at,finished_at,found_count,created_count,updated_count,error_count,welcome_sent_count,welcome_failed_count,last_error",
      )
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      trigger: r.trigger,
      status: r.status,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      found: r.found_count,
      created: r.created_count,
      updated: r.updated_count,
      failed: r.error_count,
      welcomeSent: r.welcome_sent_count,
      welcomeFailed: r.welcome_failed_count,
      message: r.last_error,
    }));
  });

/** Execução manual da sincronização (mesma rotina do agendador). */
export const runCrmSyncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context as never);
    const { runLeadSync } = await import("@/server/crm/lead-sync.server");
    return runLeadSync("manual", context.userId);
  });

/** Reenvio manual e controlado das boas-vindas de um lead. */
export const runCrmBackfillNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context as never);
    const { runGreenSalesBackfill } = await import("@/server/crm/lead-sync.server");
    return runGreenSalesBackfill(context.userId);
  });

/**
 * MOVIMENTAÇÃO MANUAL DE CONTINGÊNCIA (plano aprovado — regras 9 e 10).
 *
 * Ajuste LOCAL do espelho operacional, decidido pela gestão:
 *  - NUNCA altera a origem externa (GreenSales é a fonte da verdade);
 *  - NUNCA cria cadência nova e NUNCA dispara E0 (a data de entrada na
 *    etapa de entrada não é tocada);
 *  - salva o estágio imediatamente e audita a ação;
 *  - a próxima sincronização CORRIGE o espelho se a origem divergir —
 *    a contingência é temporária por definição.
 */
export const moveCrmLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        stageKey: z.string().min(1),
        stageLabel: z.string().min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    await assertManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordEvent } = await import("@/server/crm/lead-service.server");

    const { data: lead } = await supabaseAdmin
      .from("crm_leads")
      .select("id,external_id,stage_key,is_test")
      .eq("id", data.id)
      .maybeSingle();
    if (!lead) return { ok: false, message: "Lead não encontrado no espelho." };

    const from = (lead.stage_key as string | null) ?? "sem_etapa";
    /**
     * GRAVAÇÃO CANÔNICA: a etapa terminal existe no histórico nas duas
     * grafias. O que o sistema grava a partir de agora é sempre a forma
     * canônica — os registros antigos permanecem exatamente como estão.
     */
    const { canonicalStageKey, isTerminalStage } = await import(
      "@/lib/relationship/closing"
    );
    const targetStage = canonicalStageKey(data.stageKey) ?? data.stageKey;
    if (from === targetStage || from === data.stageKey) {
      return { ok: true, message: "O lead já está nesta etapa." };
    }

    const { error } = await supabaseAdmin
      .from("crm_leads")
      .update({
        stage_key: targetStage,
        stage_entered_at: new Date().toISOString(),
        // entered_entry_stage_at NÃO é tocado: mover manualmente para
        // NOVOS não pode tornar o lead elegível a E0/cadência.
      })
      .eq("id", data.id);
    if (error) return { ok: false, message: error.message };


    await recordEvent(
      lead.id as string,
      "movimentacao_manual",
      `Contingência local: ${from} → ${data.stageKey}. Não altera a origem, não cria cadência e não dispara E0. A próxima sincronização corrige o espelho se a origem divergir.`,
      {
        from,
        to: data.stageKey,
        toLabel: data.stageLabel,
        actorUserId: context.userId,
        scope: "espelho_local",
      },
    );
    /**
     * OPORTUNIDADE é terminal: o executivo assumiu a conversa. O ciclo
     * da Apresentação Digital (E20 + checkpoint + finalização) é
     * encerrado no mesmo instante, sem apagar histórico.
     */
    const { isTerminalStage } = await import("@/lib/relationship/closing");
    let closureNote = "";
    if (isTerminalStage(data.stageKey) && lead.external_id) {
      const { closeCycleForOpportunity } = await import(
        "@/server/relationship/opportunity.server"
      );
      const closed = await closeCycleForOpportunity(String(lead.external_id));
      if (closed.length > 0) {
        closureNote =
          " Ciclo da Apresentação Digital encerrado: checkpoint e finalização cancelados.";
      }
    }

    return {
      ok: true,
      message: `Lead movido localmente para ${data.stageLabel}. Contingência do espelho — a origem não foi alterada.${closureNote}`,
    };
  });

/**
 * LEGADO ENCERRADO (Etapa 3). O reenvio das boas-vindas antigas não
 * existe mais: o primeiro contato tem caminho único pelo Motor de
 * Relacionamento (E0), com texto da Biblioteca e executivo responsável.
 * A função permanece apenas para não quebrar chamadas existentes e
 * responde com o motivo, sem enviar nada.
 */
export const retryCrmWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context }) => {
    await assertManager(context as never);
    return {
      ok: false as const,
      outcome: "ignorada" as const,
      reason:
        "O primeiro contato é executado exclusivamente pela E0 do Motor de Relacionamento.",
    };
  });
