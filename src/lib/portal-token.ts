/**
 * Token do visitante no navegador — apenas transporte.
 *
 * A credencial é emitida e validada exclusivamente pelo servidor; aqui
 * ela é somente guardada para não repetir a emissão a cada evento.
 */
import { issuePortalToken } from "@/lib/portal-token.functions";

const KEY = "velox:portal:token:v1";

type Store = Record<string, string>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* armazenamento indisponível */
  }
}

const pending = new Map<string, Promise<string | null>>();

/** Devolve (emitindo se necessário) o token do investidor atual. */
export async function ensurePortalToken(investorId: string): Promise<string | null> {
  if (typeof window === "undefined" || !investorId) return null;
  const cached = read()[investorId];
  if (cached) return cached;
  const existing = pending.get(investorId);
  if (existing) return existing;

  const task = (async () => {
    const { loadLeads } = await import("@/lib/leads");
    const lead = loadLeads().find((l) => l.id === investorId);
    if (!lead?.email || !lead.whatsapp) return null;
    try {
      const result = await issuePortalToken({
        data: { investorId, email: lead.email, phone: lead.whatsapp },
      });
      if (!result?.token) return null;
      write({ ...read(), [investorId]: result.token });
      return result.token;
    } catch {
      return null;
    } finally {
      pending.delete(investorId);
    }
  })();
  pending.set(investorId, task);
  return task;
}

/** Descarta um token recusado pelo servidor para forçar nova emissão. */
export function clearPortalToken(investorId: string): void {
  if (typeof window === "undefined") return;
  const store = read();
  delete store[investorId];
  write(store);
}
