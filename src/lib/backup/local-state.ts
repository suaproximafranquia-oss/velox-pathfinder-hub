/**
 * Estado local do Portal (navegador) — parte integrante do ponto de
 * restauração. CRM, agenda, alertas, notas, auditoria e preferências são
 * persistidos no dispositivo; o backup só é íntegro se acompanhar o
 * estado do banco.
 *
 * Chaves de sessão e autenticação ficam de fora: restaurar um ponto
 * antigo jamais pode derrubar ou trocar a sessão do Administrador.
 */

const SESSION_PATTERN = /session|auth|activeRole|sync:ping/i;

function isConversationKey(key: string): boolean {
  return key.startsWith("crm.messages") || key.startsWith("crm.temp");
}

export type LocalScope = "completo" | "conversas";

/** Fotografa o estado local correspondente ao escopo pedido. */
export function captureLocalState(scope: LocalScope): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || SESSION_PATTERN.test(key)) continue;
    const conversation = isConversationKey(key);
    if (scope === "conversas" ? !conversation : conversation) continue;
    const value = window.localStorage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

/** Reaplica o estado local do ponto restaurado, no mesmo escopo. */
export function applyLocalState(state: Record<string, string>, scope: LocalScope): number {
  if (typeof window === "undefined") return 0;
  const current: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || SESSION_PATTERN.test(key)) continue;
    const conversation = isConversationKey(key);
    if (scope === "conversas" ? !conversation : conversation) continue;
    current.push(key);
  }
  for (const key of current) {
    if (!(key in state)) window.localStorage.removeItem(key);
  }
  let applied = 0;
  for (const [key, value] of Object.entries(state)) {
    try {
      window.localStorage.setItem(key, value);
      applied += 1;
    } catch {
      /* quota indisponível */
    }
  }
  return applied;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const BACKUP_ORIGIN_LABEL: Record<string, string> = {
  automatico: "Automático",
  manual: "Manual",
  pre_restauracao: "Pré-restauração",
};

export const BACKUP_KIND_LABEL: Record<string, string> = {
  completo: "Backup Completo do Portal",
  conversas: "Backup de Conversas",
};

/** Intervalo oficial da rotina automática (minutos). */
export const AUTO_BACKUP_INTERVAL_MINUTES = 15;