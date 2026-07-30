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
  novo: "Ativo",
  em_andamento: "Em acompanhamento",
  encerrado: "Negociação interrompida",
};

export const PORTAL_LEAD_STATUS_META: Record<
  PortalLeadStatus,
  { label: string; dot: string; text: string; border: string }
> = {
  novo: {
    label: "Ativo",
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500/40",
  },
  em_andamento: {
    label: "Em acompanhamento",
    dot: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-500/40",
  },
  encerrado: {
    label: "Negociação interrompida",
    dot: "bg-rose-500",
    text: "text-rose-400",
    border: "border-rose-500/40",
  },
};

/** Ordem cíclica usada pelo controle manual clicável no card do investidor. */
export const PORTAL_LEAD_STATUS_CYCLE: PortalLeadStatus[] = [
  "novo",
  "em_andamento",
  "encerrado",
];

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