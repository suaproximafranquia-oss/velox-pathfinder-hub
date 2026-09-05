/**
 * Central de Backup — funções de servidor.
 *
 * Tudo aqui é restrito ao Administrador: a leitura dos pontos de
 * restauração, a criação manual e, principalmente, a restauração — que
 * nunca acontece sem antes preservar o estado atual em um Backup de
 * Segurança.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BackupSummary = {
  id: string;
  label: string;
  kind: string;
  origin: string;
  status: string;
  sizeBytes: number;
  counts: Record<string, number>;
  createdAt: string;
  createdByName: string;
  referenceHour?: string | null;
  operationalDay?: string;
  operationalHour?: number;
};

export type RestoreLogEntry = {
  id: string;
  backupId: string | null;
  safetyBackupId: string | null;
  status: string;
  details: string;
  performedByName: string;
  createdAt: string;
};

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}): Promise<void> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Acesso restrito ao Administrador.");
}

/** Lista dos pontos de restauração e do histórico de restaurações. */
export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toRecord } = await import("@/server/backup.server");
    const { data } = await supabaseAdmin
      .from("portal_backups")
      .select(
        "id,label,kind,origin,status,size_bytes,table_counts,created_at,created_by_name,reference_hour",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    const { data: restores } = await supabaseAdmin
      .from("portal_restores")
      .select("id,backup_id,safety_backup_id,status,details,performed_by_name,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const backups = ((data ?? []) as Record<string, unknown>[]).map(toRecord) as BackupSummary[];
    return {
      backups,
      restores: ((restores ?? []) as Record<string, unknown>[]).map<RestoreLogEntry>((r) => ({
        id: String(r["id"]),
        backupId: (r["backup_id"] as string) ?? null,
        safetyBackupId: (r["safety_backup_id"] as string) ?? null,
        status: String(r["status"] ?? ""),
        details: String(r["details"] ?? ""),
        performedByName: String(r["performed_by_name"] ?? ""),
        createdAt: String(r["created_at"] ?? ""),
      })),
      totalBytes: backups.reduce((sum, b) => sum + b.sizeBytes, 0),
    };
  });

/** "Criar Backup Completo Agora" — sem interromper o Portal. */
export const createBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      kind: "completo" | "conversas";
      actorName: string;
      localState?: Record<string, string> | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { createBackup } = await import("@/server/backup.server");
    const record = await createBackup({
      kind: data.kind,
      origin: "manual",
      createdBy: context.userId,
      createdByName: data.actorName || "Administrador",
      localState: data.localState ?? null,
    });
    return record as BackupSummary;
  });

/**
 * Restauração protegida: o estado atual é sempre preservado antes.
 * Se o Backup de Segurança falhar, a restauração não começa.
 */
export const restorePortalBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      backupId: string;
      actorName: string;
      localState?: Record<string, string> | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { createBackup, restoreBackupPayload } = await import("@/server/backup.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("portal_backups")
      .select("id,label,kind,created_at")
      .eq("id", data.backupId)
      .single();
    if (!target) throw new Error("Ponto de restauração não encontrado.");
    const kind = String((target as Record<string, unknown>)["kind"] ?? "completo") as
      | "completo"
      | "conversas";

    // 1) Backup de Segurança — obrigatório e concluído antes de tudo.
    const safety = await createBackup({
      kind,
      origin: "pre_restauracao",
      label: "Backup de Segurança — Antes da Restauração",
      createdBy: context.userId,
      createdByName: data.actorName || "Administrador",
      localState: data.localState ?? null,
    });

    // 2) Restauração propriamente dita.
    try {
      const result = await restoreBackupPayload(data.backupId);
      await supabaseAdmin.from("portal_restores").insert({
        backup_id: data.backupId,
        safety_backup_id: safety.id,
        status: "concluida",
        details: Object.entries(result.restored)
          .map(([t, n]) => `${t}: ${n}`)
          .join(" · ")
          .concat(
            result.skipped.length > 0
              ? ` | preservadas por política (fonte da verdade externa): ${result.skipped.join(", ")}`
              : "",
          ),
        performed_by: context.userId,
        performed_by_name: data.actorName || "Administrador",
      });
      return { ok: true as const, safetyBackupId: safety.id, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na restauração.";
      await supabaseAdmin.from("portal_restores").insert({
        backup_id: data.backupId,
        safety_backup_id: safety.id,
        status: "falhou",
        details: message,
        performed_by: context.userId,
        performed_by_name: data.actorName || "Administrador",
      });
      throw new Error(
        `${message} O estado anterior permanece disponível no Backup de Segurança criado agora.`,
      );
    }
  });
/**
 * Situação da fila automática — leitura adicional, sem qualquer efeito
 * sobre restauração ou retenção.
 */
export type BackupQueueItem = {
  id: string;
  referenceHour: string;
  status: string;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  backupId: string | null;
};

export const listBackupQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { listBackupRequests } = await import("@/server/backup-queue.server");
    const items = await listBackupRequests(48);
    return items.map<BackupQueueItem>((i) => ({
      id: i.id,
      referenceHour: i.referenceHour,
      status: i.status,
      attempts: i.attempts,
      startedAt: i.startedAt,
      completedAt: i.completedAt,
      lastError: i.lastError,
      backupId: i.backupId,
    }));
  });
