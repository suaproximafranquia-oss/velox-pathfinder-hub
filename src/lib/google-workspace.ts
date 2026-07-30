/**
 * Google Workspace — camada de conta conectada (Épico 8).
 *
 * A autenticação é OAuth 2.0 oficial: o consentimento acontece em um
 * popup do Google e a credencial resultante fica exclusivamente no
 * servidor, criptografada e vinculada ao executivo autenticado. Nenhum
 * token trafega ou é persistido no navegador.
 */
import { emitEvent } from "@/lib/events/bus";
import { logAudit } from "@/lib/audit-log";
import {
  disconnectGoogle,
  getGoogleConnections,
  startGoogleConnect,
  type GoogleConnectionStatus,
  type GoogleConnectorKey,
} from "@/lib/google.functions";

export type GoogleConnectionState = "idle" | "connecting" | "connected" | "error";

export type GoogleAccount = {
  email: string;
  name?: string;
  picture?: string | null;
  scopes?: string[];
  connectedAt?: string;
};

export type GoogleStore = {
  ownerId: string;
  state: GoogleConnectionState;
  account: GoogleAccount | null;
  /** Situação individual de Calendar/Meet, Drive e Gmail. */
  connectors: GoogleConnectionStatus[];
  error: string | null;
  updatedAt: string;
};

export type { GoogleConnectorKey };

export const GOOGLE_SCOPES: readonly string[] = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send",
];

/** A integração oficial está provisionada nesta versão. */
export const GOOGLE_INTEGRATION_CONFIGURED = true;

export const CONNECTOR_LABEL: Record<GoogleConnectorKey, string> = {
  google_calendar: "Google Calendar e Meet",
  google_drive: "Google Drive",
  google_mail: "Gmail",
};

const CACHE_PREFIX = "velox:google-workspace:v2:";
const CHANGED_EVENT = "velox:google-workspace:changed";

const memory = new Map<string, GoogleStore>();

function empty(ownerId: string): GoogleStore {
  return {
    ownerId,
    state: "idle",
    account: null,
    connectors: [],
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

function cacheKey(ownerId: string) {
  return `${CACHE_PREFIX}${ownerId}`;
}

function write(store: GoogleStore) {
  memory.set(store.ownerId, store);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(store.ownerId), JSON.stringify(store));
  } catch {
    /* noop */
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: store.ownerId }));
}

/** Estado conhecido (cache) — use `refreshGoogleStore` para atualizar. */
export function getGoogleStore(ownerId: string): GoogleStore {
  const cached = memory.get(ownerId);
  if (cached) return cached;
  if (typeof window === "undefined") return empty(ownerId);
  try {
    const raw = window.localStorage.getItem(cacheKey(ownerId));
    if (!raw) return empty(ownerId);
    const parsed = { ...empty(ownerId), ...(JSON.parse(raw) as GoogleStore) };
    memory.set(ownerId, parsed);
    return parsed;
  } catch {
    return empty(ownerId);
  }
}

export function subscribeGoogleStore(ownerId: string, listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  function handler(ev: Event) {
    const detail = (ev as CustomEvent<string>).detail;
    if (!detail || detail === ownerId) listener();
  }
  function storageHandler(ev: StorageEvent) {
    if (ev.key === cacheKey(ownerId)) listener();
  }
  window.addEventListener(CHANGED_EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(CHANGED_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

/** Consulta o servidor e atualiza o estado das três integrações. */
export async function refreshGoogleStore(ownerId: string): Promise<GoogleStore> {
  try {
    const connectors = await getGoogleConnections();
    const calendar = connectors.find((c) => c.connectorId === "google_calendar");
    const primary = connectors.find((c) => c.connected && c.accountEmail) ?? calendar;
    const next: GoogleStore = {
      ownerId,
      state: calendar?.connected ? "connected" : "idle",
      account: primary?.connected
        ? { email: primary.accountEmail ?? "conta Google", connectedAt: primary.updatedAt ?? undefined }
        : null,
      connectors,
      error: null,
      updatedAt: new Date().toISOString(),
    };
    write(next);
    return next;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar a conta Google.";
    const next: GoogleStore = { ...getGoogleStore(ownerId), state: "error", error: message };
    write(next);
    return next;
  }
}

export function isConnectorConnected(store: GoogleStore, connectorId: GoogleConnectorKey): boolean {
  return store.connectors.some((c) => c.connectorId === connectorId && c.connected);
}

function waitForOAuth(popup: Window, connectorId: GoogleConnectorKey): Promise<void> {
  return new Promise((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    function onMessage(event: MessageEvent) {
      const type = (event.data as { type?: string; connectorId?: string })?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        (event.data as { connectorId?: string })?.connectorId !== connectorId ||
        (type !== "google-oauth-complete" && type !== "google-oauth-failed")
      ) {
        return;
      }
      cleanup();
      if (type === "google-oauth-complete") return resolve();
      popup.close();
      reject(new Error("A autorização com o Google não foi concluída."));
    }
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("A janela do Google foi fechada antes da conclusão."));
    }, 500);
  });
}

export type ConnectActor = { userId: string; userName: string; userRole: string };

/** Abre o consentimento oficial do Google e persiste a credencial. */
export async function startConnect(
  actor: ConnectActor,
  connectorId: GoogleConnectorKey = "google_calendar",
): Promise<GoogleStore> {
  const owner = actor.userId;
  write({ ...getGoogleStore(owner), state: "connecting", error: null });

  const popup = window.open("", "velox-google-oauth", "width=620,height=740");
  if (!popup) {
    return setConnectError(owner, "Permita janelas pop-up para conectar sua conta Google.");
  }
  try {
    const { authorizationUrl } = await startGoogleConnect({ data: { connectorId } });
    const completion = waitForOAuth(popup, connectorId);
    popup.location.href = authorizationUrl;
    await completion;
  } catch (err) {
    popup.close();
    const message = err instanceof Error ? err.message : "Falha ao conectar a conta Google.";
    return setConnectError(owner, message);
  }

  const store = await refreshGoogleStore(owner);
  emitEvent({
    type: "google.connected",
    actorId: owner,
    payload: { connectorId, email: store.account?.email ?? null },
  });
  logAudit({
    actorId: owner,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "administracao",
    action: `Google Workspace · ${CONNECTOR_LABEL[connectorId]} conectado`,
    target: store.account?.email ?? "conta Google",
    details: "Autenticação OAuth 2.0 concluída com credencial individual do executivo.",
    severity: "success",
  });
  return store;
}

export function setConnectError(ownerId: string, error: string): GoogleStore {
  const next: GoogleStore = { ...getGoogleStore(ownerId), state: "error", error };
  write(next);
  emitEvent({ type: "google.token.failed", actorId: ownerId, payload: { error } });
  return next;
}

/** Revoga a credencial no gateway e limpa o vínculo. */
export async function disconnect(
  actor: ConnectActor,
  connectorId: GoogleConnectorKey = "google_calendar",
): Promise<GoogleStore> {
  const owner = actor.userId;
  const email = getGoogleStore(owner).account?.email ?? "—";
  try {
    await disconnectGoogle({ data: { connectorId } });
  } catch {
    /* segue atualizando o estado local */
  }
  const store = await refreshGoogleStore(owner);
  emitEvent({ type: "google.disconnected", actorId: owner, payload: { connectorId, email } });
  logAudit({
    actorId: owner,
    actorName: actor.userName,
    actorRole: actor.userRole,
    module: "administracao",
    action: `Google Workspace · ${CONNECTOR_LABEL[connectorId]} desconectado`,
    target: email,
    severity: "warning",
  });
  return store;
}

export function isExpired(_store: GoogleStore): boolean {
  // A renovação de tokens é responsabilidade do gateway seguro da Lovable.
  return false;
}