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
] as const;

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

  const { data, error } = await supabaseAdmin
    .from("portal_backups")
    .insert({
      label: input.label ?? defaultLabel(input.kind, input.origin),
      kind: input.kind,
      origin: input.origin,
      status: "concluido",
      size_bytes: serialized.length,
      table_counts: counts as never,
      payload: payload as never,
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
  localState: Record<string, string> | null;
};

/** Reescreve o banco com o conteúdo do ponto de restauração escolhido. */
export async function restoreBackupPayload(backupId: string): Promise<RestoreResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("portal_backups")
    .select("payload,kind")
    .eq("id", backupId)
    .single();
  if (error || !data) throw new Error("Ponto de restauração não encontrado.");
  const payload = (data as Row)["payload"] as {
    tables?: Record<string, Row[]>;
    localState?: Record<string, string> | null;
  };
  const tables = payload?.tables ?? {};
  const restored: Record<string, number> = {};

  for (const { table, pk } of BACKUP_TABLES) {
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
  return { restored, localState: payload?.localState ?? null };
}

/**
 * Retenção: mantém densidade alta no passado recente e reduz
 * gradualmente os pontos antigos. Backups manuais e de segurança nunca
 * são removidos automaticamente.
 */
export async function pruneBackups(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("portal_backups")
    .select("id,created_at,origin,kind")
    .eq("origin", "automatico")
    .order("created_at", { ascending: false });
  if (error || !data) return 0;

  const now = Date.now();
  const hour = 3_600_000;
  const keep = new Set<string>();
  const buckets = new Set<string>();
  for (const row of data as Row[]) {
    const id = String(row["id"]);
    const at = Date.parse(String(row["created_at"]));
    const age = now - at;
    let bucket: string;
    if (age <= 24 * hour) {
      bucket = `raw:${id}`; // últimas 24h: todos os pontos
    } else if (age <= 7 * 24 * hour) {
      bucket = `hour:${Math.floor(at / hour)}`; // 7 dias: 1 por hora
    } else if (age <= 60 * 24 * hour) {
      bucket = `day:${Math.floor(at / (24 * hour))}`; // 60 dias: 1 por dia
    } else {
      bucket = `week:${Math.floor(at / (7 * 24 * hour))}`; // depois: 1 por semana
    }
    if (buckets.has(bucket)) continue;
    buckets.add(bucket);
    keep.add(id);
  }
  const remove = (data as Row[])
    .map((r) => String(r["id"]))
    .filter((id) => !keep.has(id));
  if (!remove.length) return 0;
  await supabaseAdmin.from("portal_backups").delete().in("id", remove);
  return remove.length;
}