/**
 * Motor de Eventos — semente (Parte 1/3).
 *
 * Emissor pub/sub em memória, com persistência opcional dos últimos
 * eventos em localStorage para reconstrução de linha do tempo /
 * notificações após um reload. Não contém regra de negócio: cada
 * módulo apenas emite ou observa eventos.
 *
 * A Parte 2 conectará consumidores estruturais (IA, RAG, Auditoria
 * Inteligente etc.) sem alterar esta camada.
 */

export type PortalEventType =
  | "journey.started"
  | "manual.completed"
  | "material.viewed"
  | "simulator.started"
  | "simulator.completed"
  | "meeting.created"
  | "meeting.rescheduled"
  | "meeting.completed"
  | "meeting.cancelled"
  | "meeting.deleted"
  | "profile.updated"
  // Etapa 2 — eventos administrativos e de governança.
  | "admin.settings.updated"
  | "admin.customField.created"
  | "admin.customField.updated"
  | "admin.customField.removed"
  | "knowledge.document.published"
  | "knowledge.document.updated"
  | "knowledge.document.removed"
  | "resource.created"
  | "resource.updated"
  | "resource.removed"
  | "ai.query.answered"
  // Etapa 2 — Google Workspace.
  | "google.connected"
  | "google.disconnected"
  | "google.token.renewed"
  | "google.token.failed";

export type PortalEvent<T = Record<string, unknown>> = {
  id: string;
  type: PortalEventType;
  at: string; // ISO
  actorId?: string | null;
  investorId?: string | null;
  payload?: T;
};

type Listener = (event: PortalEvent) => void;

const STORAGE_KEY = "velox:events:v1";
const MAX_PERSIST = 500;
const listeners = new Set<Listener>();

function safeRead(): PortalEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PortalEvent[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: PortalEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_PERSIST)));
  } catch {
    /* noop */
  }
}

function newId(): string {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emitEvent<T = Record<string, unknown>>(
  input: Omit<PortalEvent<T>, "id" | "at"> & { at?: string },
): PortalEvent<T> {
  const event: PortalEvent<T> = {
    id: newId(),
    at: input.at ?? new Date().toISOString(),
    type: input.type,
    actorId: input.actorId ?? null,
    investorId: input.investorId ?? null,
    payload: input.payload,
  };
  const all = safeRead();
  all.push(event as PortalEvent);
  safeWrite(all);
  for (const l of listeners) {
    try {
      l(event as PortalEvent);
    } catch {
      /* isolar consumidores defeituosos */
    }
  }
  return event;
}

export function onEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listEvents(filter?: {
  types?: PortalEventType[];
  investorId?: string;
  since?: string;
}): PortalEvent[] {
  const all = safeRead();
  return all.filter((e) => {
    if (filter?.types && !filter.types.includes(e.type)) return false;
    if (filter?.investorId && e.investorId !== filter.investorId) return false;
    if (filter?.since && e.at < filter.since) return false;
    return true;
  });
}

export function clearEvents(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}