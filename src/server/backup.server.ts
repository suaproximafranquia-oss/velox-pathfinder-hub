/**
 * Motor da Central de Backup — SERVER ONLY.
 *
 * Um ponto de restauração representa o estado integral dos dados
 * persistidos do Portal. Nenhuma operação aqui apaga dados por conta
 * própria: a limpeza atinge exclusivamente pontos de restauração antigos,
 * conforme a política de retenção, e a restauração só ocorre depois de o
 * estado atual ter sido preservado em um Backup de Segurança.
 */

/** Tabelas que compõem o estado operacional do Portal. */
export const BACKUP_TABLES = [
  { table: "portal_leads", pk: "id" },
  { table: "campaigns", pk: "id" },
  { table: "meta_templates", pk: "id" },
  { table: "news_posts", pk: "id" },
  { table: "knowledge_documents", pk: "id" },
  { table: "creative_templates", pk: "model" },
  { table: "creative_official_model", pk: "id" },
  { table: "executive_profiles", pk: "user_id" },
  { table: "user_roles", pk: "id" },
  { table: "whatsapp_validations", pk: "id" },
  { table: "app_user_connections", pk: "id" },
  { table: "magazine_editions", pk: "id" },
  { table: "magazine_pages", pk: "id" },
  { table: "portal_institutional_blocks", pk: "id" },
] as const;

/**
 * COMANDO 3C §19 — DOMÍNIOS QUE NUNCA SÃO RESTAURADOS.
 *
 * Portal dos Leads, CRM operacional e GreenSales têm o GreenSales como
 * fonte da verdade. Restaurar um estado antigo dessas tabelas recriaria
 * leads apagados e reverteria etapas reais. Elas continuam sendo
 * capturadas (backup/exportação e auditoria), mas a restauração as
 * ignora mesmo quando presentes no ponto de restauração.
 */
export const NEVER_RESTORE_TABLES: readonly string[] = [
  "portal_leads",
  "crm_leads",
  "crm_pipelines",
  "crm_pipeline_stages",
  "crm_cadence_tasks",
  "crm_sync_runs",
  "crm_lead_events",
  "crm_messages",
  "crm_timeline",
  "crm_connections",
];

export type BackupKind = "completo" | "conversas";
export type BackupOrigin = "automatico" | "manual" | "pre_restauracao";

type Row = Record<string, unknown>;

export type CapturedState = {
  tables: Record<string, Row[]>;
  counts: Record<string, number>;
};

/** Lê integralmente o estado persistido no banco, sem bloquear o Portal. */
export async function captureDatabaseState(): Promise<CapturedState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tables: Record<string, Row[]> = {};
  const counts: Record<string, number> = {};
  for (const { table } of BACKUP_TABLES) {
    const rows: Row[] = [];
    const page = 500;
    for (let from = 0; ; from += page) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select("*")
        .range(from, from + page - 1);
      if (error) throw new Error(`Falha ao ler ${table}: ${error.message}`);
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < page) break;
    }
    tables[table] = rows;
    counts[table] = rows.length;
  }
  return { tables, counts };
}

export type CreateBackupInput = {
  kind: BackupKind;
  origin: BackupOrigin;
  label?: string;
  createdBy?: string | null;
  createdByName?: string;
  /** Estado local do navegador do Administrador (CRM, agenda, alertas…). */
  localState?: Record<string, string> | null;
};

export type BackupRecord = {
  id: string;
  label: string;
  kind: string;
  origin: string;
  status: string;
  sizeBytes: number;
  counts: Record<string, number>;
  createdAt: string;
  createdByName: string;
};

function defaultLabel(kind: BackupKind, origin: BackupOrigin): string {
  if (origin === "pre_restauracao") return "Backup de Segurança — Antes da Restauração";
  return kind === "conversas" ? "Backup de Conversas" : "Backup Completo do Portal";
}

/**
 * Política oficial de retenção dos pontos AUTOMÁTICOS.
 * Backups manuais e de segurança seguem política própria: nunca são
 * removidos pela rotina.
 */
export const RETENTION = {
  /** Últimas 48 horas: todos os pontos (um a cada 15 minutos). */
  fullHours: 48,
  /**
   * COMANDO 2 §27 — depois das 48 horas permanece apenas o ÚLTIMO ponto
   * de cada dia (fechamento do dia, ~23:45), por 7 dias corridos.
   */
  dailyDays: 7,
} as const;

/**
 * Assinatura do conteúdo. Pontos idênticos (Portal parado entre duas
 * execuções) reaproveitam o mesmo conteúdo em vez de duplicar o
 * armazenamento — sem perder nenhum ponto do histórico.
 */
async function hashPayload(serialized: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(serialized).digest("hex");
}

/** Conteúdo do ponto — do repositório compartilhado ou do formato antigo. */
export async function readBackupPayload(backupId: string): Promise<{
  tables?: Record<string, Row[]>;
  localState?: Record<string, string> | null;
} | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("portal_backups")
    .select("payload,payload_hash")
    .eq("id", backupId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Row;
  const hash = row["payload_hash"] as string | null;
  if (hash) {
    const { data: blob } = await supabaseAdmin
      .from("portal_backup_blobs")
      .select("payload")
      .eq("hash", hash)
      .maybeSingle();
    if (blob) return (blob as Row)["payload"] as never;
  }
  return (row["payload"] as never) ?? null;
}

/** Cria um ponto de restauração a partir do estado atual do Portal. */
export async function createBackup(input: CreateBackupInput): Promise<BackupRecord> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const isConversations = input.kind === "conversas";
  const captured = isConversations
    ? { tables: {}, counts: {} }
    : await captureDatabaseState();
  const payload = {
    version: 1,
    capturedAt: new Date().toISOString(),
    tables: captured.tables,
    localState: input.localState ?? null,
  };
  const counts: Record<string, number> = { ...captured.counts };
  if (input.localState) counts["estado_local"] = Object.keys(input.localState).length;
  const serialized = JSON.stringify(payload);
  const hash = await hashPayload(serialized);

  // O conteúdo é gravado uma única vez por assinatura.
  const { data: existingBlob } = await supabaseAdmin
    .from("portal_backup_blobs")
    .select("hash")
    .eq("hash", hash)
    .maybeSingle();
  if (!existingBlob) {
    const { error: blobError } = await supabaseAdmin.from("portal_backup_blobs").insert({
      hash,
      payload: payload as never,
      size_bytes: serialized.length,
    });
    if (blobError && !blobError.message.includes("duplicate")) {
      throw new Error(`Falha ao gravar o conteúdo do backup: ${blobError.message}`);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("portal_backups")
    .insert({
      label: input.label ?? defaultLabel(input.kind, input.origin),
      kind: input.kind,
      origin: input.origin,
      status: "concluido",
      size_bytes: serialized.length,
      table_counts: counts as never,
      payload: {} as never,
      payload_hash: hash,
      // Manuais e de segurança nunca são apagados pela rotina.
      protected: input.origin !== "automatico",
      created_by: input.createdBy ?? null,
      created_by_name: input.createdByName ?? "Sistema",
    })
    .select("id,label,kind,origin,status,size_bytes,table_counts,created_at,created_by_name")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao gravar o ponto de restauração.");
  return toRecord(data as Row);
}

export function toRecord(row: Row): BackupRecord {
  return {
    id: String(row["id"]),
    label: String(row["label"] ?? ""),
    kind: String(row["kind"] ?? "completo"),
    origin: String(row["origin"] ?? "automatico"),
    status: String(row["status"] ?? "concluido"),
    sizeBytes: Number(row["size_bytes"] ?? 0),
    counts: (row["table_counts"] as Record<string, number>) ?? {},
    createdAt: String(row["created_at"] ?? ""),
    createdByName: String(row["created_by_name"] ?? "Sistema"),
  };
}

export type RestoreResult = {
  restored: Record<string, number>;
  /** Tabelas ignoradas por política (§19). */
  skipped: string[];
  localState: Record<string, string> | null;
};

/** Reescreve o banco com o conteúdo do ponto de restauração escolhido. */
export async function restoreBackupPayload(backupId: string): Promise<RestoreResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const payload = await readBackupPayload(backupId);
  if (!payload) throw new Error("Ponto de restauração não encontrado.");
  const tables = payload?.tables ?? {};
  const restored: Record<string, number> = {};
  const skipped: string[] = [];

  for (const { table, pk } of BACKUP_TABLES) {
    // §19 — fonte da verdade externa: jamais sobrescrever.
    if (NEVER_RESTORE_TABLES.includes(table)) {
      if (tables[table]) skipped.push(table);
      continue;
    }
    const rows = tables[table];
    if (!rows) continue; // tabela ausente no ponto → mantida intacta
    const del = await supabaseAdmin.from(table).delete().not(pk, "is", null);
    if (del.error) throw new Error(`Falha ao limpar ${table}: ${del.error.message}`);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const ins = await supabaseAdmin.from(table).insert(chunk as never);
      if (ins.error) throw new Error(`Falha ao restaurar ${table}: ${ins.error.message}`);
    }
    restored[table] = rows.length;
  }
  return { restored, skipped, localState: payload?.localState ?? null };
}

/**
 * Retenção oficial dos pontos automáticos:
 *  · últimas 48 horas — todos (a cada 15 minutos);
 *  · de 48 horas a 30 dias — 1 por dia;
 *  · acima de 30 dias — 1 por semana, por 8 semanas;
 *  · além disso, o ponto é descartado.
 * Backups manuais e de segurança seguem política própria e nunca são
 * removidos aqui. Ao final, conteúdos sem nenhum ponto associado são
 * liberados — nenhum dado do Portal é tocado.
 */
export async function pruneBackups(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("portal_backups")
    .select("id,created_at,origin,kind,protected")
    .eq("origin", "automatico")
    .order("created_at", { ascending: false });
  if (error || !data) return 0;

  const now = Date.now();
  const hour = 3_600_000;
  const day = 24 * hour;
  const keep = new Set<string>();
  const buckets = new Set<string>();
  const drop: string[] = [];
  for (const row of data as Row[]) {
    const id = String(row["id"]);
    if (row["protected"] === true) {
      keep.add(id);
      continue;
    }
    const at = Date.parse(String(row["created_at"]));
    const age = now - at;
    let bucket: string;
    if (age <= RETENTION.fullHours * hour) {
      bucket = `raw:${id}`; // 48h: todos os pontos de 15 em 15 minutos
    } else if (age <= RETENTION.dailyDays * day) {
      bucket = `day:${Math.floor(at / day)}`; // até 30 dias: 1 por dia
    } else if (age <= (RETENTION.dailyDays + RETENTION.weeklyWeeks * 7) * day) {
      bucket = `week:${Math.floor(at / (7 * day))}`; // 8 semanas: 1 por semana
    } else {
      drop.push(id); // além do horizonte de retenção
      continue;
    }
    if (buckets.has(bucket)) continue;
    buckets.add(bucket);
    keep.add(id);
  }
  const remove = (data as Row[])
    .map((r) => String(r["id"]))
    .filter((id) => !keep.has(id) && !drop.includes(id))
    .concat(drop);
  if (remove.length) {
    for (let i = 0; i < remove.length; i += 100) {
      await supabaseAdmin
        .from("portal_backups")
        .delete()
        .in("id", remove.slice(i, i + 100));
    }
  }
  await pruneOrphanBlobs();
  return remove.length;
}

/** Libera conteúdos que não pertencem mais a nenhum ponto de restauração. */
async function pruneOrphanBlobs(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: refs } = await supabaseAdmin
    .from("portal_backups")
    .select("payload_hash")
    .not("payload_hash", "is", null);
  const used = new Set((refs ?? []).map((r) => String((r as Row)["payload_hash"])));
  const { data: blobs } = await supabaseAdmin.from("portal_backup_blobs").select("hash");
  const orphans = (blobs ?? [])
    .map((b) => String((b as Row)["hash"]))
    .filter((h) => !used.has(h));
  for (let i = 0; i < orphans.length; i += 100) {
    await supabaseAdmin
      .from("portal_backup_blobs")
      .delete()
      .in("hash", orphans.slice(i, i + 100));
  }
}