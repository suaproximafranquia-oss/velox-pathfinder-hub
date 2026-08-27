/**
 * Fila de solicitações de backup — SERVER ONLY.
 *
 * Por que existe: o agendador do banco corta a chamada HTTP em 5
 * segundos, enquanto a captura completa do Portal leva mais que isso.
 * Antes, o corte significava a perda daquela hora. Agora o relógio
 * apenas REGISTRA a solicitação da hora cheia (operação local, de
 * milissegundos) e um processador separado executa o trabalho pesado.
 *
 * A prova de conclusão nunca é a resposta HTTP: é a persistência
 * verificada do ponto de restauração.
 *
 * Nada aqui toca no Portal dos Leads. A fila é uma estrutura própria,
 * aditiva, e a retenção continua exatamente como estava.
 */

export type BackupRequestStatus = "pendente" | "processando" | "concluido" | "falha";

export type BackupRequest = {
  id: string;
  referenceHour: string;
  status: BackupRequestStatus;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
  leaseExpiresAt: string | null;
  leaseOwner: string | null;
  lastError: string | null;
  backupId: string | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

/** Tempo máximo de uma tentativa antes de a solicitação voltar à fila. */
export const LEASE_MINUTES = 10;
/** Além disso, a hora é marcada como falha e deixa de ser tentada. */
export const MAX_ATTEMPTS = 5;

/** Hora cheia de referência, em UTC. */
export function referenceHourOf(date: Date = new Date()): string {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function toRequest(row: Row): BackupRequest {
  return {
    id: String(row["id"]),
    referenceHour: String(row["reference_hour"]),
    status: String(row["status"] ?? "pendente") as BackupRequestStatus,
    attempts: Number(row["attempts"] ?? 0),
    startedAt: (row["started_at"] as string) ?? null,
    completedAt: (row["completed_at"] as string) ?? null,
    leaseExpiresAt: (row["lease_expires_at"] as string) ?? null,
    leaseOwner: (row["lease_owner"] as string) ?? null,
    lastError: (row["last_error"] as string) ?? null,
    backupId: (row["backup_id"] as string) ?? null,
    createdAt: String(row["created_at"] ?? ""),
  };
}

/**
 * Registra a solicitação da hora cheia. Idempotente: a chave única por
 * hora garante que duas chamadas na mesma hora não criem duas
 * solicitações.
 */
export async function enqueueBackupRequest(
  hour: string = referenceHourOf(),
): Promise<{ created: boolean; referenceHour: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("portal_backup_requests")
    .insert({ reference_hour: hour, status: "pendente" });
  if (error) {
    const duplicate =
      error.code === "23505" ||
      /duplicate|unique/i.test(error.message ?? "");
    if (duplicate) return { created: false, referenceHour: hour };
    throw new Error(`Falha ao registrar a solicitação de backup: ${error.message}`);
  }
  return { created: true, referenceHour: hour };
}

/**
 * Toma a solicitação executável mais antiga: pendente, ou em
 * processamento com o lease vencido (tentativa anterior interrompida).
 * A tomada é um UPDATE condicional — duas execuções simultâneas nunca
 * ficam com o mesmo item.
 */
async function claimNextRequest(owner: string): Promise<BackupRequest | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: candidates } = await supabaseAdmin
    .from("portal_backup_requests")
    .select(
      "id,reference_hour,status,attempts,started_at,completed_at,lease_expires_at,lease_owner,last_error,backup_id,created_at",
    )
    .in("status", ["pendente", "processando"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("reference_hour", { ascending: true })
    .limit(10);

  for (const row of (candidates ?? []) as Row[]) {
    const item = toRequest(row);
    // Em processamento com lease válido: outra execução está cuidando.
    if (
      item.status === "processando" &&
      item.leaseExpiresAt &&
      Date.parse(item.leaseExpiresAt) > now.getTime()
    ) {
      continue;
    }
    const leaseUntil = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();
    const claim = supabaseAdmin
      .from("portal_backup_requests")
      .update({
        status: "processando",
        attempts: item.attempts + 1,
        started_at: nowIso,
        lease_owner: owner,
        lease_expires_at: leaseUntil,
      })
      .eq("id", item.id)
      .eq("attempts", item.attempts);
    // Só assume quem venceu a corrida pelo número de tentativas.
    const { data: claimed } = await claim.select("id").maybeSingle();
    if (claimed) return { ...item, attempts: item.attempts + 1 };
  }
  return null;
}

export type ProcessResult =
  | { processed: false; reason: "vazio" }
  | { processed: true; referenceHour: string; backupId: string; attempts: number }
  | { processed: true; referenceHour: string; failed: true; attempts: number; error: string };

/**
 * Executa UMA solicitação por chamada. Sem solicitação pendente, a
 * execução custa uma única leitura.
 */
export async function processNextBackupRequest(): Promise<ProcessResult> {
  const owner = `worker-${Math.random().toString(36).slice(2, 10)}`;
  const item = await claimNextRequest(owner);
  if (!item) return { processed: false, reason: "vazio" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createBackup, validateBackupPersisted, pruneBackups } = await import(
    "@/server/backup.server"
  );

  try {
    // Retry nunca duplica: se a hora já produziu um ponto, reaproveita.
    const { data: existing } = await supabaseAdmin
      .from("portal_backups")
      .select("id")
      .eq("reference_hour", item.referenceHour)
      .eq("origin", "automatico")
      .maybeSingle();

    let backupId = existing ? String((existing as Row)["id"]) : null;
    if (!backupId) {
      const record = await createBackup({
        kind: "completo",
        origin: "automatico",
        referenceHour: item.referenceHour,
      });
      backupId = record.id;
    }

    // A conclusão só vale depois de o ponto existir de fato, com
    // conteúdo legível — resposta HTTP não é prova de nada.
    const valid = await validateBackupPersisted(backupId);
    if (!valid.ok) throw new Error(valid.reason);

    await supabaseAdmin
      .from("portal_backup_requests")
      .update({
        status: "concluido",
        completed_at: new Date().toISOString(),
        backup_id: backupId,
        lease_owner: null,
        lease_expires_at: null,
        last_error: null,
      })
      .eq("id", item.id);

    await pruneBackups();
    return {
      processed: true,
      referenceHour: item.referenceHour,
      backupId,
      attempts: item.attempts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    const exhausted = item.attempts >= MAX_ATTEMPTS;
    await supabaseAdmin
      .from("portal_backup_requests")
      .update({
        // Ainda com tentativas: volta para a fila no ciclo seguinte.
        status: exhausted ? "falha" : "pendente",
        last_error: message.slice(0, 1000),
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("id", item.id);
    return {
      processed: true,
      referenceHour: item.referenceHour,
      failed: true,
      attempts: item.attempts,
      error: message,
    };
  }
}

/** Situação recente da fila — leitura para a Central de Backup. */
export async function listBackupRequests(limit = 48): Promise<BackupRequest[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("portal_backup_requests")
    .select(
      "id,reference_hour,status,attempts,started_at,completed_at,lease_expires_at,lease_owner,last_error,backup_id,created_at",
    )
    .order("reference_hour", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map(toRequest);
}
