/**
 * CRM de Relacionamento — Timeline automática do sistema.
 *
 * Toda ocorrência relevante é registrada automaticamente, sem qualquer
 * interação do usuário: data, hora, origem, motivo, Executivo responsável
 * e evento ocorrido. O log é append-only.
 */
export type CrmTimelineEvent =
  | "relacionamento_oficial"
  | "duplicidade_detectada"
  | "acesso_bloqueado"
  | "conversa_aberta"
  | "sincronizacao";

export const CRM_TIMELINE_LABEL: Record<CrmTimelineEvent, string> = {
  relacionamento_oficial: "Relacionamento oficial definido",
  duplicidade_detectada: "Duplicidade identificada",
  acesso_bloqueado: "Acesso bloqueado por relacionamento ativo",
  conversa_aberta: "Conversa aberta",
  sincronizacao: "Sincronização de base",
};

export type CrmTimelineEntry = {
  id: string;
  /** ISO completo — data e hora do registro. */
  at: string;
  investorId: string;
  event: CrmTimelineEvent;
  /** Origem do investidor/ocorrência (Green Sales, Portal, manual…). */
  origin: string;
  /** Motivo objetivo da ocorrência. */
  reason: string;
  /** Executivo responsável oficial no momento do registro. */
  ownerId: string;
  /** Usuário que provocou a ocorrência (pode diferir do responsável). */
  actorId: string;
};

const STORAGE_KEY = "crm.timeline.v1";
const LIMIT = 2000;

function readAll(): CrmTimelineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CrmTimelineEntry[]) : [];
  } catch {
    return [];
  }
}

/** Registro automático — silencioso e idempotente por ocorrência única. */
export function recordCrmEvent(entry: Omit<CrmTimelineEntry, "id" | "at">): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  const last = all[all.length - 1];
  if (
    last &&
    last.investorId === entry.investorId &&
    last.event === entry.event &&
    last.actorId === entry.actorId &&
    Date.now() - Date.parse(last.at) < 60_000
  ) {
    return; // evita duplicar a mesma ocorrência em sequência
  }
  const next: CrmTimelineEntry = {
    ...entry,
    id: `crmtl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...all, next].slice(-LIMIT)),
    );
  } catch {
    /* armazenamento indisponível */
  }
}

export function listCrmTimeline(investorId?: string): CrmTimelineEntry[] {
  const all = readAll();
  const scoped = investorId ? all.filter((e) => e.investorId === investorId) : all;
  return scoped.slice().reverse();
}

export function formatCrmTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
