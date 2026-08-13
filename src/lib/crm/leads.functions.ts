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
    return runLeadSync("manual");
  });

/** Reenvio manual e controlado das boas-vindas de um lead. */
export const retryCrmWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSettings, processWelcome } = await import("@/server/crm/automation.server");
    const { data: lead } = await supabaseAdmin
      .from("crm_leads")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!lead) return { ok: false as const, outcome: "ignorada" as const };
    // Reenvio manual é uma decisão humana: zera o contador para que a
    // tentativa aconteça mesmo após falhas anteriores.
    if (lead.welcome_status === "FAILED") {
      await supabaseAdmin.from("crm_leads").update({ welcome_attempts: 0 }).eq("id", data.id);
    }
    const settings = await loadSettings();
    const outcome = await processWelcome(lead as never, settings);
    return { ok: outcome === "enviada", outcome };
  });
