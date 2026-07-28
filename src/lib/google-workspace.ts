/**
 * Google Workspace — Infraestrutura de Autenticação (Etapa 2 — Bloco 1A · Parte 1/2).
 *
 * Prepara toda a camada de gerenciamento da conta Google (persistência,
 * renovação de token, auditoria e eventos) que será consumida na Parte 2/2
 * pelas integrações Calendar, Meet, Gmail e Contacts.
 *
 * Nesta etapa NÃO cria eventos, NÃO gera Meet e NÃO envia convites.
 *
 * A troca OAuth 2.0 real será conectada quando as credenciais oficiais
 * do App User Connector estiverem provisionadas; até lá, `startConnect`
 * simula um round-trip para validar o fluxo (estados, persistência,
 * eventos e auditoria) sem depender de infraestrutura externa.
 */
import { emitEvent } from "@/lib/events/bus";
import { logAudit } from "@/lib/audit-log";

export type GoogleConnectionState = "idle" | "connecting" | "connected" | "error";

export type GoogleAccount = {
  googleUserId: string;
  name: string;
  email: string;
  picture: string | null;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  connectedAt: string; // ISO
  expiresAt: string; // ISO
};

export type GoogleStore = {
  ownerId: string; // ExecutiveSession.userId
  state: GoogleConnectionState;
  account: GoogleAccount | null;
  error: string | null;
  updatedAt: string;
};

export const GOOGLE_SCOPES: readonly string[] = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Sinaliza se a integração OAuth real com o Google Workspace já foi
 * provisionada. Enquanto `false`, `startConnect` NÃO simula uma conta
 * conectada — apenas registra o estado neutro "Integração não
 * configurada". A UI (card e indicador) já se comporta em estado neutro
 * independentemente deste sinalizador, garantindo consistência.
 */
export const GOOGLE_INTEGRATION_CONFIGURED = false;

const STORAGE_PREFIX = "velox:google-workspace:v1:";
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min ≈ Google access-token

function storageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}${ownerId}`;
}

function safeRead(ownerId: string): GoogleStore {
  if (typeof window === "undefined") return empty(ownerId);
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return empty(ownerId);
    const parsed = JSON.parse(raw) as GoogleStore;
    return { ...empty(ownerId), ...parsed };
  } catch {
    return empty(ownerId);
  }
}

function safeWrite(store: GoogleStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(store.ownerId), JSON.stringify(store));
    window.dispatchEvent(new CustomEvent("velox:google-workspace:changed", { detail: store.ownerId }));
  } catch {
    /* noop */
  }
}

function empty(ownerId: string): GoogleStore {
  return {
    ownerId,
    state: "idle",
    account: null,
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

function tokenId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Estado atual da conta Google do executivo. */
export function getGoogleStore(ownerId: string): GoogleStore {
  return safeRead(ownerId);
}

/** Assina mudanças no store — chamado pelo indicador global e pelo card. */
export function subscribeGoogleStore(ownerId: string, listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  function handler(ev: Event) {
    const detail = (ev as CustomEvent<string>).detail;
    if (!detail || detail === ownerId) listener();
  }
  function storageHandler(ev: StorageEvent) {
    if (ev.key === storageKey(ownerId)) listener();
  }
  window.addEventListener("velox:google-workspace:changed", handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener("velox:google-workspace:changed", handler);
    window.removeEventListener("storage", storageHandler);
  };
}

/**
 * Inicia a autenticação OAuth 2.0.
 *
 * Nesta fase de preparação a troca de tokens é simulada para validar o
 * pipeline completo (estados, persistência, eventos, auditoria). A
 * substituição pela chamada real ao App User Connector será feita na
 * Parte 2/2 sem alterar a superfície pública desta função.
 */
export async function startConnect(actor: {
  userId: string;
  userName: string;
  userRole: string;
}): Promise<GoogleStore> {
  const owner = actor.userId;
  if (!GOOGLE_INTEGRATION_CONFIGURED) {
    // Nunca criar conta fictícia. Mantém o estado neutro.
    const cleared: GoogleStore = {
      ownerId: owner,
      state: "idle",
      account: null,
      error: "Integração ainda não configurada.",
      updatedAt: new Date().toISOString(),
    };
    safeWrite(cleared);
    return cleared;
  }
  const current = safeRead(owner);
  if (current.state === "connecting") return current;
  const connecting: GoogleStore = {
    ...current,
    state: "connecting",
    error: null,
    updatedAt: new Date().toISOString(),
  };
  safeWrite(connecting);
  // Simula o round-trip do provedor. Substituível por popup real na Parte 2.
  await new Promise((r) => setTimeout(r, 900));
  const now = Date.now();
  const account: GoogleAccount = {
    googleUserId: `g_${owner}`,
    name: actor.userName,
    email: actor.userName
      .toLowerCase()
      .replace(/[^a-z]+/g, ".")
      .replace(/(^\.|\.$)/g, "") + "@gmail.com",
    picture: null,
    accessToken: tokenId("at"),
    refreshToken: tokenId("rt"),
    scopes: [...GOOGLE_SCOPES],
    connectedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
  };
  const connected: GoogleStore = {
    ownerId: owner,
    state: "connected",
    account,
    error: null,
    updatedAt: new Date().toISOString(),
  };
  safeWrite(connected);
  emitEvent({
    type: "google.connected",
    actorId: owner,
    payload: { googleUserId: account.googleUserId, email: account.email },
  });
  logAudit({
    actorId: owner,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "administracao",
    action: "Google Workspace · conta conectada",
    target: account.email,
    details: `Escopos: ${account.scopes.length} · Expira em ${new Date(account.expiresAt).toLocaleString("pt-BR")}.`,
    severity: "success",
  });
  return connected;
}

export function setConnectError(ownerId: string, error: string): GoogleStore {
  const next: GoogleStore = {
    ...safeRead(ownerId),
    state: "error",
    error,
    updatedAt: new Date().toISOString(),
  };
  safeWrite(next);
  emitEvent({
    type: "google.token.failed",
    actorId: ownerId,
    payload: { error },
  });
  return next;
}

/** Desconecta a conta atual — remove tokens e perfil, mantém reuniões. */
export function disconnect(actor: {
  userId: string;
  userName: string;
  userRole: string;
}): GoogleStore {
  const owner = actor.userId;
  const current = safeRead(owner);
  const email = current.account?.email ?? "—";
  const cleared: GoogleStore = {
    ownerId: owner,
    state: "idle",
    account: null,
    error: null,
    updatedAt: new Date().toISOString(),
  };
  safeWrite(cleared);
  emitEvent({
    type: "google.disconnected",
    actorId: owner,
    payload: { email },
  });
  logAudit({
    actorId: owner,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "administracao",
    action: "Google Workspace · conta desconectada",
    target: email,
    severity: "warning",
  });
  return cleared;
}

/**
 * Renova o access token via refresh token. Em caso de falha muda o
 * estado para "error" e emite `google.token.failed`.
 */
export async function refreshAccessToken(ownerId: string): Promise<GoogleStore> {
  const current = safeRead(ownerId);
  if (!current.account) return current;
  try {
    // Simula chamada de refresh — Parte 2 conectará ao gateway real.
    await new Promise((r) => setTimeout(r, 400));
    const now = Date.now();
    const account: GoogleAccount = {
      ...current.account,
      accessToken: tokenId("at"),
      expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
    };
    const next: GoogleStore = {
      ...current,
      state: "connected",
      account,
      error: null,
      updatedAt: new Date().toISOString(),
    };
    safeWrite(next);
    emitEvent({
      type: "google.token.renewed",
      actorId: ownerId,
      payload: { expiresAt: account.expiresAt },
    });
    logAudit({
      actorId: ownerId,
      actorName: current.account.name,
      actorRole: "Sistema",
      module: "administracao",
      action: "Google Workspace · token renovado",
      target: current.account.email,
      severity: "info",
    });
    return next;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao renovar token.";
    const next: GoogleStore = {
      ...current,
      state: "error",
      error: "Reconectar conta.",
      updatedAt: new Date().toISOString(),
    };
    safeWrite(next);
    emitEvent({ type: "google.token.failed", actorId: ownerId, payload: { error: message } });
    logAudit({
      actorId: ownerId,
      actorName: current.account.name,
      actorRole: "Sistema",
      module: "administracao",
      action: "Google Workspace · falha na renovação",
      target: current.account.email,
      details: message,
      severity: "critical",
    });
    return next;
  }
}

/** Se o token estiver expirado, tenta renovar; senão retorna o token vigente. */
export async function ensureFreshToken(ownerId: string): Promise<string | null> {
  const store = safeRead(ownerId);
  if (!store.account) return null;
  const expiresAt = new Date(store.account.expiresAt).getTime();
  if (expiresAt - Date.now() > 60_000) return store.account.accessToken;
  const renewed = await refreshAccessToken(ownerId);
  return renewed.account?.accessToken ?? null;
}

export function isExpired(store: GoogleStore): boolean {
  if (!store.account) return false;
  return new Date(store.account.expiresAt).getTime() <= Date.now();
}