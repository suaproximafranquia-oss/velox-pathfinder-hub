/**
 * CRM de Relacionamento — política de sessão (fundação).
 *
 * A sessão é a mesma da Central do Executivo. Aqui apenas preparamos a
 * regra de inatividade: ~4 horas consecutivas sem qualquer interação
 * podem encerrar a sessão. Nenhuma lógica complexa nesta etapa.
 */
export const CRM_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;

const LAST_ACTIVITY_KEY = "crm:lastActivity:v1";

export function markCrmActivity(now: number = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {
    /* armazenamento indisponível — a sessão segue válida */
  }
}

export function readLastCrmActivity(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** true quando o intervalo de inatividade excede o limite previsto. */
export function isCrmSessionExpired(now: number = Date.now()): boolean {
  const last = readLastCrmActivity();
  if (last === null) return false;
  return now - last > CRM_IDLE_TIMEOUT_MS;
}