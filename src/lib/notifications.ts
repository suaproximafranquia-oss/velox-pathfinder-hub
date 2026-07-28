/**
 * Central de Notificações — Parte 1/3.
 *
 * Consumidora do bus de eventos. Mantém uma lista persistida por
 * usuário com contador de não lidas. Discreta por design: nunca
 * interrompe o fluxo do usuário.
 */
import { onEvent, listEvents, type PortalEvent, type PortalEventType } from "@/lib/events/bus";

export type Notification = {
  id: string;
  at: string;
  type: PortalEventType;
  title: string;
  description: string;
  investorId: string | null;
  read: boolean;
};

const STORAGE_KEY = "velox:notifications:v1";

function safeRead(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Notification[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: Notification[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* noop */
  }
}

function describe(event: PortalEvent): { title: string; description: string } | null {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const inv = event.investorId ? ` (${event.investorId})` : "";
  switch (event.type) {
    case "journey.started":
      return { title: "Jornada iniciada", description: `Novo investidor iniciou a jornada${inv}.` };
    case "manual.completed":
      return { title: "Manual concluído", description: `Manual do Investidor concluído${inv}.` };
    case "material.viewed":
      return { title: "Material acessado", description: `Material institucional acessado${inv}.` };
    case "simulator.started":
      return { title: "Simulação iniciada", description: `Simulador Inteligente iniciado${inv}.` };
    case "simulator.completed": {
      const total = typeof payload.total === "number" ? payload.total : null;
      return {
        title: "Simulação concluída",
        description: total != null
          ? `Simulador concluído — potencial mensal estimado ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}${inv}.`
          : `Simulador Inteligente concluído${inv}.`,
      };
    }
    case "meeting.created":
      return { title: "Reunião criada", description: `Nova reunião agendada${inv}.` };
    case "meeting.rescheduled":
      return { title: "Reunião reagendada", description: `Horário atualizado${inv}.` };
    case "meeting.completed":
      return { title: "Reunião concluída", description: `Reunião finalizada${inv}.` };
    case "meeting.cancelled":
      return { title: "Reunião cancelada", description: `Reunião cancelada${inv}.` };
    case "profile.updated":
      return { title: "Perfil atualizado", description: `Cadastro atualizado${inv}.` };
    default:
      return null;
  }
}

function ingest(event: PortalEvent) {
  const info = describe(event);
  if (!info) return;
  const all = safeRead();
  all.push({
    id: `nt_${event.id}`,
    at: event.at,
    type: event.type,
    title: info.title,
    description: info.description,
    investorId: event.investorId ?? null,
    read: false,
  });
  safeWrite(all);
}

let subscribed = false;
export function ensureNotificationsSubscribed(): void {
  if (subscribed || typeof window === "undefined") return;
  subscribed = true;
  // Backfill: converte eventos já persistidos que ainda não viraram notificação.
  const existing = new Set(safeRead().map((n) => n.id));
  for (const e of listEvents()) {
    if (!existing.has(`nt_${e.id}`)) ingest(e);
  }
  onEvent(ingest);
}

export function listNotifications(): Notification[] {
  return [...safeRead()].reverse();
}

export function unreadCount(): number {
  return safeRead().filter((n) => !n.read).length;
}

export function markAllRead(): void {
  const all = safeRead().map((n) => ({ ...n, read: true }));
  safeWrite(all);
}

export function markRead(id: string): void {
  const all = safeRead().map((n) => (n.id === id ? { ...n, read: true } : n));
  safeWrite(all);
}

export function clearNotifications(): void {
  safeWrite([]);
}