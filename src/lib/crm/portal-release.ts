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

function persist(store: Record<string, PortalRelease>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* armazenamento indisponível */
  }
}

/**
 * Espelha no navegador a liberação que já existe no banco. O cache local
 * é apenas leitura rápida: a verdade continua sendo o servidor.
 */
export function applyRemoteRelease(
  investorId: string,
  remote: { releasedAt: string; releasedByName?: string | null; reason?: string | null } | null,
): void {
  const store = read();
  if (!remote) {
    if (!store[investorId]) return;
    delete store[investorId];
    persist(store);
    return;
  }
  const current = store[investorId];
  if (current && current.releasedAt === remote.releasedAt) return;
  store[investorId] = {
    investorId,
    releasedAt: remote.releasedAt,
    releasedBy: current?.releasedBy ?? "",
    releasedByName: remote.releasedByName ?? current?.releasedByName ?? "Administrador",
    reason: remote.reason ?? current?.reason ?? "",
  };
  persist(store);
  notifySync("commercial");
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
  persist(store);
  // Persistência REAL: sem esta gravação a liberação existiria apenas no
  // navegador do Executivo e o investidor continuaria bloqueado.
  if (typeof window !== "undefined") {
    void import("@/lib/portal-access.functions")
      .then((m) =>
        m.releasePortalAccess({
          data: {
            investorId: input.investorId,
            actorName: input.actorName,
            reason: record.reason || "Liberação manual do Portal",
          },
        }),
      )
      .catch(() => {
        /* o executivo é avisado pela ausência do selo após a atualização */
      });
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
