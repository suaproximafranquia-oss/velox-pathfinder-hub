/**
 * Central de Auditoria — Atlas Platform.
 *
 * Registro imutável de ações administrativas relevantes. Persistência
 * em localStorage (fase homologação); arquitetura preparada para
 * futura sincronização com backend, exportações e dashboards.
 *
 * Regras:
 *  1. Toda entrada é append-only. Nunca sobrescrevemos ou excluímos.
 *  2. Ações automáticas são atribuídas ao ator "Sistema".
 *  3. Nenhum dado sensível é gravado — apenas metadados descritivos.
 */

import { notifySync } from "@/lib/sync-bus";

export type AuditModule =
  | "usuarios"
  | "kpi"
  | "investidores"
  | "conhecimento"
  | "recursos"
  | "administracao"
  | "ia"
  | "sistema";

export const AUDIT_MODULE_LABEL: Record<AuditModule, string> = {
  usuarios: "Usuários",
  kpi: "KPI Manager",
  investidores: "Investidores",
  conhecimento: "Central de Conhecimento",
  recursos: "Centro de Recursos",
  administracao: "Administração",
  ia: "IA Corporativa",
  sistema: "Sistema",
};

export type AuditSeverity = "info" | "success" | "warning" | "critical";

export type AuditEntry = {
  id: string;
  timestamp: number;
  actorId: string; // "system" para eventos automáticos
  actorName: string;
  actorRole: string;
  module: AuditModule;
  action: string;
  target?: string;
  details?: string;
  severity: AuditSeverity;
};

const STORAGE_KEY = "atlas.audit.log.v1";
const SEED_FLAG = "atlas.audit.seeded.v1";

function readAll(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: AuditEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* silencioso — quota */
  }
  notifySync("audit");
}

function newId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `au_${Date.now().toString(36)}_${rnd}`;
}

export function logAudit(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const full: AuditEntry = { ...entry, id: newId(), timestamp: Date.now() };
  const all = readAll();
  all.unshift(full);
  // Retenção permanente — mantemos tudo. Cap de segurança apenas contra
  // storm de eventos em ambiente de homologação (10k).
  if (all.length > 10000) all.length = 10000;
  writeAll(all);
  return full;
}

export function logSystemAudit(
  module: AuditModule,
  action: string,
  extra?: { target?: string; details?: string; severity?: AuditSeverity },
): AuditEntry {
  return logAudit({
    actorId: "system",
    actorName: "Sistema",
    actorRole: "Automatizado",
    module,
    action,
    target: extra?.target,
    details: extra?.details,
    severity: extra?.severity ?? "info",
  });
}

export type AuditFilter = {
  query?: string;
  module?: AuditModule | "all";
  actorId?: string | "all";
  severity?: AuditSeverity | "all";
  from?: number;
  to?: number;
};

export function listAudit(filter: AuditFilter = {}): AuditEntry[] {
  const q = (filter.query ?? "").trim().toLowerCase();
  return readAll().filter((e) => {
    if (filter.module && filter.module !== "all" && e.module !== filter.module) return false;
    if (filter.actorId && filter.actorId !== "all" && e.actorId !== filter.actorId) return false;
    if (filter.severity && filter.severity !== "all" && e.severity !== filter.severity) return false;
    if (filter.from && e.timestamp < filter.from) return false;
    if (filter.to && e.timestamp > filter.to) return false;
    if (q) {
      const hay = `${e.action} ${e.actorName} ${e.target ?? ""} ${e.details ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function distinctActors(): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const e of readAll()) if (!map.has(e.actorId)) map.set(e.actorId, e.actorName);
  return Array.from(map, ([id, name]) => ({ id, name }));
}

/**
 * DEF 2.4.RESET — a Central de Auditoria nunca recebe registros de exemplo.
 * Mantida apenas para compatibilidade de chamadas existentes.
 */
export function seedAuditIfEmpty(): void {
  /* no-op — proibido criar auditorias fictícias. */
}

/** Formata timestamp em pt-BR com precisão de minutos. */
export function formatAuditTime(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const AUDIT_SEVERITY_LABEL: Record<AuditSeverity, string> = {
  info: "Informativo",
  success: "Concluído",
  warning: "Atenção",
  critical: "Crítico",
};