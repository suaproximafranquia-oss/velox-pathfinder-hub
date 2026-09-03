/**
 * ATUALIZAÇÃO ESTRUTURAL §1 — cache reativo das permissões de módulo.
 *
 * O servidor é a autoridade. Este módulo mantém no navegador apenas uma
 * cópia de exibição, atualizada por:
 *   • carga inicial;
 *   • verificação periódica (15 s);
 *   • retorno do foco à aba;
 *   • gravação feita pelo próprio Administrador.
 *
 * Assim, desligar o CRM de um colaborador reflete em qualquer outra
 * sessão sem logout e sem F5.
 */
import type { WorkspaceModuleKey, WorkspacePermissionMap } from "@/lib/workspace-permissions";

/** Espelho local — otimização visual no primeiro render, nunca autoridade. */
const MIRROR_KEY = "atlas:workspace-permissions:v1";
const POLL_MS = 15_000;

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: WorkspacePermissionMap = readMirror();
/** `true` só depois que o servidor respondeu ao menos uma vez. */
let authoritative = false;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

function readMirror(): WorkspacePermissionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as WorkspacePermissionMap) : {};
  } catch {
    return {};
  }
}

function writeMirror(map: WorkspacePermissionMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(map));
  } catch {
    /* armazenamento indisponível — o servidor continua sendo a verdade */
  }
}

function sameMap(a: WorkspacePermissionMap, b: WorkspacePermissionMap): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function commit(next: WorkspacePermissionMap): void {
  if (sameMap(cache, next)) return;
  cache = next;
  writeMirror(next);
  for (const listener of listeners) listener();
}

function fromRows(
  rows: { userId: string; moduleKey: string; enabled: boolean }[],
): WorkspacePermissionMap {
  const map: WorkspacePermissionMap = {};
  for (const row of rows) {
    const key = row.moduleKey as WorkspaceModuleKey;
    if (key !== "crm" && key !== "portal_leads" && key !== "e0_automatico") continue;
    map[row.userId] = { ...(map[row.userId] ?? {}), [key]: row.enabled };
  }
  return map;
}

export function getWorkspacePermissionCache(): WorkspacePermissionMap {
  return cache;
}

export function isWorkspacePermissionAuthoritative(): boolean {
  return authoritative;
}

export function subscribeWorkspacePermissions(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Busca o estado oficial. Falhas mantêm o cache atual (nunca liberam nada). */
export function refreshWorkspacePermissions(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { listWorkspacePermissions } = await import("@/lib/workspace-permissions.functions");
      const rows = await listWorkspacePermissions();
      authoritative = true;
      commit(fromRows(rows));
    } catch {
      /* sessão ainda não aberta ou rede indisponível */
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Gravação do Administrador — o retorno do servidor é aplicado de imediato. */
export async function persistWorkspacePermission(input: {
  userId: string;
  moduleKey: WorkspaceModuleKey;
  enabled: boolean;
  actorName?: string;
}): Promise<boolean> {
  const { setWorkspacePermission } = await import("@/lib/workspace-permissions.functions");
  const rows = await setWorkspacePermission({
    data: {
      userId: input.userId,
      moduleKey: input.moduleKey,
      enabled: input.enabled,
      ...(input.actorName ? { actorName: input.actorName } : {}),
    },
  });
  authoritative = true;
  commit(fromRows(rows));
  return true;
}

/** Inicia a sincronização contínua. Idempotente. */
export function startWorkspacePermissionSync(): void {
  if (typeof window === "undefined" || timer) return;
  void refreshWorkspacePermissions();
  timer = setInterval(() => void refreshWorkspacePermissions(), POLL_MS);
  window.addEventListener("focus", () => void refreshWorkspacePermissions());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshWorkspacePermissions();
  });
}
