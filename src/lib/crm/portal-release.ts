/**
 * DEF 2.4.16 §9 — Liberação manual do Portal do Investidor.
 *
 * A liberação manual foi REMOVIDA do CRM. Este módulo apenas espelha no
 * navegador a liberação oficial vinda do servidor, mantendo a leitura
 * rápida do estado do Portal.
 */
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
