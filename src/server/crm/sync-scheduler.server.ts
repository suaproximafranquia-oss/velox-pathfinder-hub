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

  let summary: SyncSummary;
  try {
    summary = await runLeadSync("cron");
  } finally {
    /**
     * COMANDO 3A §4/§8 — a fila da E0 adiada pela madrugada pertence ao
     * Portal inteiro (GreenSales E leads nascidos no Portal), não à
     * consulta da origem externa: mesmo se a sincronização falhar, a
     * abertura da janela das 07:00 é sempre honrada. Idempotente.
     */
    try {
      const { processDeferredFirstContacts } = await import(
        "@/server/crm/first-contact-queue.server"
      );
      await processDeferredFirstContacts();
    } catch (error) {
      console.error(
        "[crm-sync] fila da E0 adiada não pôde ser processada:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  /**
   * Depois de sincronizar, o MOTOR DE MENSAGENS é reavaliado. Os dois
   * motores continuam independentes: uma falha aqui não invalida a
   * sincronização, e a fila de ligações é calculada em outro lugar.
   */
  try {
    const { runRelationshipTick } = await import("@/server/relationship/scheduler.server");
    await runRelationshipTick();
  } catch (error) {
    console.error(
      "[crm-sync] motor de relacionamento não pôde ser reavaliado:",
      error instanceof Error ? error.message : error,
    );
  }
  /**
   * COMANDO 3A §6 — reconciliação periódica (1x ao dia): quem saiu da
   * visão da origem sem deixar de existir é preservado na coluna local
   * NÃO LOCALIZADOS. Nada é apagado — a blindagem dos Leads permanece.
   */
  try {
    const { runDailyReconciliation } = await import("@/server/crm/reconcile.server");
    await runDailyReconciliation();
  } catch (error) {
    console.error(
      "[crm-sync] reconciliação periódica não pôde ser avaliada:",
      error instanceof Error ? error.message : error,
    );
  }
  return { ran: true, summary, intervalMinutes };
}
