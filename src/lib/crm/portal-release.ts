/**
 * DEF 2.4.16 §9 — Liberação manual do Portal do Investidor.
 *
 * Administrador e Gestora podem liberar imediatamente todo o Portal para
 * um Investidor, ignorando a confirmação pendente do WhatsApp. A ação
 * NUNCA cria Lead e NUNCA altera o Executivo responsável — apenas
 * registra usuário, data, hora e motivo.
 */
import { logAudit } from "@/lib/audit-log";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { notifySync } from "@/lib/sync-bus";

export type PortalRelease = {
  investorId: string;
  releasedAt: string;
  releasedBy: string;
  releasedByName: string;
  reason: string;
};

const KEY = "crm.portal-release.v1";

function read(): Record<string, PortalRelease> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function isPortalReleased(investorId: string): boolean {
  return Boolean(read()[investorId]);
}

export function getPortalRelease(investorId: string): PortalRelease | null {
  return read()[investorId] ?? null;
}

export function releasePortal(input: {
  investorId: string;
  investorName: string;
  actorId: string;
  actorName: string;
  actorRole?: string;
  ownerId?: string;
  origin?: string;
  reason: string;
}): PortalRelease {
  const record: PortalRelease = {
    investorId: input.investorId,
    releasedAt: new Date().toISOString(),
    releasedBy: input.actorId,
    releasedByName: input.actorName,
    reason: input.reason.trim(),
  };
  const store = read();
  store[input.investorId] = record;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* armazenamento indisponível */
    }
  }
  notifySync("commercial");
  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole ?? "Administrador",
    module: "investidores",
    action: "Portal do Investidor liberado manualmente",
    target: input.investorName,
    details: `Liberado em ${new Date(record.releasedAt).toLocaleString("pt-BR")}. Motivo: ${record.reason}. Nenhum Lead criado e Executivo responsável inalterado.`,
    severity: "warning",
  });
  recordCrmEvent({
    investorId: input.investorId,
    event: "portal_liberado",
    origin: input.origin ?? "Portal Velox",
    reason: `Portal liberado por ${input.actorName}. Motivo: ${record.reason}`,
    ownerId: input.ownerId ?? input.actorId,
    actorId: input.actorId,
  });
  return record;
}
