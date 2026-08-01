/**
 * Controle de acesso aos Backups de Conversas (DEF 2.4.9 §4 e §5).
 *
 * Nenhum backup é aberto sem motivo declarado. Toda abertura gera log
 * permanente (usuário, data, hora e motivo) — também espelhado na
 * Central de Auditoria. A Gestora nunca vê conversas automaticamente:
 * recebe apenas uma cópia temporária de 24 horas liberada pelo
 * Administrador; expirado o prazo, o backup permanece exclusivamente na
 * Central Corporativa.
 */
import { logAudit } from "@/lib/audit-log";

export const BACKUP_REASONS = [
  "Solicitação da Gestora",
  "Solicitação do Administrador",
  "Solicitação da Diretoria",
  "Solicitação Judicial",
  "Auditoria",
] as const;

export type BackupAccessEntry = {
  id: string;
  at: string;
  investorId: string;
  investorName: string;
  userId: string;
  userName: string;
  userRole: string;
  reason: string;
};

const LOG_KEY = "crm.backup.access.v1";
const GRANT_KEY = "crm.backup.grants.v1";
const GRANT_MS = 24 * 60 * 60 * 1000;

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Log permanente e append-only de cada abertura de backup. */
export function recordBackupAccess(input: {
  investorId: string;
  investorName: string;
  userId: string;
  userName: string;
  userRole: string;
  reason: string;
}): BackupAccessEntry {
  const entry: BackupAccessEntry = {
    id: `bka_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...input,
  };
  write(LOG_KEY, [...read<BackupAccessEntry>(LOG_KEY), entry]);
  logAudit({
    actorId: input.userId,
    actorName: input.userName,
    actorRole: input.userRole,
    module: "investidores",
    action: "Abertura de Backup de Conversas",
    target: input.investorName,
    details: `Motivo declarado: ${input.reason}`,
    severity: "warning",
  });
  return entry;
}

export function listBackupAccessLog(investorId?: string): BackupAccessEntry[] {
  const all = read<BackupAccessEntry>(LOG_KEY);
  const scoped = investorId ? all.filter((e) => e.investorId === investorId) : all;
  return scoped.slice().reverse();
}

export type BackupGrant = {
  investorId: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
};

function activeGrants(): BackupGrant[] {
  const now = Date.now();
  const all = read<BackupGrant>(GRANT_KEY).filter(
    (g) => Date.parse(g.expiresAt) > now,
  );
  return all;
}

/** Autorização temporária (24h) do Administrador para a Gestora. */
export function grantBackupToSupervisor(
  investorId: string,
  adminId: string,
): BackupGrant {
  const now = Date.now();
  const grant: BackupGrant = {
    investorId,
    grantedBy: adminId,
    grantedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + GRANT_MS).toISOString(),
  };
  const others = activeGrants().filter((g) => g.investorId !== investorId);
  write(GRANT_KEY, [...others, grant]);
  return grant;
}

export function revokeBackupGrant(investorId: string): void {
  write(
    GRANT_KEY,
    activeGrants().filter((g) => g.investorId !== investorId),
  );
}

export function listBackupGrants(): BackupGrant[] {
  const list = activeGrants();
  write(GRANT_KEY, list); // limpeza automática dos expirados
  return list;
}

export function backupGrantFor(investorId: string): BackupGrant | null {
  return activeGrants().find((g) => g.investorId === investorId) ?? null;
}

export function formatGrantRemaining(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "expirada";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}
