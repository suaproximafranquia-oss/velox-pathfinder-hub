/**
 * Status manual do Lead do Portal.
 *
 * Controle simples (não é Kanban nem Pipeline): o Executivo alterna
 * entre três estados operacionais. Toda alteração é registrada no
 * barramento de eventos e permanece persistida localmente.
 */
import { emitEvent } from "@/lib/events/bus";

export type PortalLeadStatus = "novo" | "em_andamento" | "encerrado";

export const PORTAL_LEAD_STATUS_LABEL: Record<PortalLeadStatus, string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
  encerrado: "Encerrado",
};

export const PORTAL_LEAD_STATUS_META: Record<
  PortalLeadStatus,
  { label: string; dot: string; text: string; border: string }
> = {
  novo: {
    label: "Novo",
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500/40",
  },
  em_andamento: {
    label: "Em andamento",
    dot: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-500/40",
  },
  encerrado: {
    label: "Encerrado",
    dot: "bg-neutral-500",
    text: "text-neutral-400",
    border: "border-neutral-500/40",
  },
};

const KEY = "velox:portal-lead-status:v1";

type Map = Record<string, PortalLeadStatus>;

function read(): Map {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Map) : {};
  } catch {
    return {};
  }
}

function write(map: Map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

export function getPortalLeadStatus(leadId: string): PortalLeadStatus {
  return read()[leadId] ?? "novo";
}

export function setPortalLeadStatus(
  leadId: string,
  status: PortalLeadStatus,
  actorId?: string | null,
): void {
  const map = read();
  const previous = map[leadId] ?? "novo";
  if (previous === status) return;
  map[leadId] = status;
  write(map);
  emitEvent({
    type: "lead.status.changed",
    investorId: leadId,
    actorId: actorId ?? null,
    payload: { from: previous, to: status },
  });
}