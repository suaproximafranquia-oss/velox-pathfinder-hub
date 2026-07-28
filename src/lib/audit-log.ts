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
 * Seed único de amostras para orientar a homologação. Nunca é aplicado
 * duas vezes — presença do flag impede re-execução.
 */
export function seedAuditIfEmpty(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_FLAG)) return;
  const now = Date.now();
  const min = 60_000;
  const seed: Omit<AuditEntry, "id">[] = [
    {
      timestamp: now - 5 * min,
      actorId: "system",
      actorName: "Sistema",
      actorRole: "Automatizado",
      module: "sistema",
      action: "Central de Auditoria inicializada",
      details: "Registro inicial gerado no primeiro acesso ao módulo.",
      severity: "info",
    },
    {
      timestamp: now - 42 * min,
      actorId: "system",
      actorName: "Sistema",
      actorRole: "Automatizado",
      module: "kpi",
      action: "Sincronização diária do KPI Manager",
      details: "Recalculo automático dos indicadores consolidados.",
      severity: "success",
    },
    {
      timestamp: now - 6 * 60 * min,
      actorId: "u_thiago",
      actorName: "Thiago Velox",
      actorRole: "Administrador",
      module: "usuarios",
      action: "Perfil atualizado",
      target: "Larissa Diretor",
      details: "Cargo e telefone corporativo revisados.",
      severity: "info",
    },
    {
      timestamp: now - 26 * 60 * min,
      actorId: "u_thiago",
      actorName: "Thiago Velox",
      actorRole: "Administrador",
      module: "conhecimento",
      action: "Documento publicado",
      target: "Playbook Consultivo v3",
      details: "Visibilidade: Público — disponível para todos os perfis.",
      severity: "success",
    },
    {
      timestamp: now - 3 * 24 * 60 * min,
      actorId: "u_larissa",
      actorName: "Larissa Diretor",
      actorRole: "Gestor",
      module: "investidores",
      action: "Investidor vinculado",
      target: "Investidor #4821",
      details: "Executivo responsável definido.",
      severity: "info",
    },
  ];
  const entries: AuditEntry[] = seed.map((e) => ({ ...e, id: newId() }));
  writeAll(entries);
  window.localStorage.setItem(SEED_FLAG, "1");
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