/**
 * Agendador da sincronização do CRM.
 *
 * O relógio vem do banco (pg_cron), que chama a rota pública a cada
 * minuto. Aqui decidimos se a execução realmente acontece: respeitamos o
 * intervalo configurado em `crm_automation_settings.sync_interval_minutes`
 * e impedimos duas sincronizações concorrentes.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSettings } from "@/server/crm/automation.server";
import { runLeadSync, type SyncSummary } from "@/server/crm/lead-sync.server";

/** Uma execução travada em RUNNING além disso é considerada abandonada. */
const STALE_RUN_MINUTES = 15;

export type ScheduledSyncResult =
  | { ran: true; summary: SyncSummary; intervalMinutes: number }
  | { ran: false; reason: "intervalo" | "execucao-em-andamento"; intervalMinutes: number };

export async function runScheduledLeadSync(): Promise<ScheduledSyncResult> {
  const settings = await loadSettings();
  const intervalMinutes = Math.max(1, settings.syncIntervalMinutes || 5);
  const now = Date.now();

  const { data: recent } = await supabaseAdmin
    .from("crm_sync_runs")
    .select("status,started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.started_at) {
    const startedAt = new Date(recent.started_at).getTime();
    const ageMinutes = (now - startedAt) / 60_000;
    // Trava simples de concorrência: uma execução recente ainda em curso.
    if (recent.status === "RUNNING" && ageMinutes < STALE_RUN_MINUTES) {
      return { ran: false, reason: "execucao-em-andamento", intervalMinutes };
    }
    if (recent.status !== "RUNNING" && ageMinutes < intervalMinutes) {
      return { ran: false, reason: "intervalo", intervalMinutes };
    }
  }

  const summary = await runLeadSync("cron");
  return { ran: true, summary, intervalMinutes };
}
