/**
 * Google Workspace — camada de conta conectada (Épico 8).
 *
 * A autenticação é OAuth 2.0 oficial: o consentimento acontece em um
 * popup do Google e a credencial resultante fica exclusivamente no
 * servidor, criptografada e vinculada ao Portal Velox. Nenhum
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

/** Serviços da mesma Conta Google — nunca conectados individualmente. */
export const GOOGLE_ACCOUNT_CONNECTORS: GoogleConnectorKey[] = [
  "google_calendar",
  "google_drive",
  "google_mail",
];

/**
 * Mensagens amigáveis: nenhum detalhe técnico (token, OAuth, callback,
 * stacktrace, Unauthorized) chega à tela do executivo.
 */
export function friendlyGoogleMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/SEM_PERMISSAO_CONTA_GOOGLE/i.test(raw))
    return "Apenas a administração pode gerenciar a Conta Google do Portal.";
  if (/pop-?up/i.test(raw)) return "Permita janelas pop-up para conectar sua Conta Google.";
  if (/fechada|closed/i.test(raw)) return "A conexão foi interrompida antes de ser concluída.";
  return "Não foi possível concluir a conexão com o Google. Tente novamente.";
}

const CHANGED_EVENT = "velox:google-workspace:changed";

/**
 * O Portal possui UMA Conta Google corporativa: o estado é único e
 * compartilhado por todos os usuários, nunca por executivo.
 */
export const CORPORATE_STORE_ID = "conta-google-corporativa";

/** Somente Administrador e Gestor administram a Conta Google. */
export function canManageGoogleAccount(role: string): boolean {
  return role === "super_admin" || role === "diretora";
}

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

function write(store: GoogleStore) {
  memory.set(CORPORATE_STORE_ID, store);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: CORPORATE_STORE_ID }));
}

/** Estado apenas de apresentação; a fonte de verdade é sempre o servidor. */
export function getGoogleStore(ownerId: string): GoogleStore {
  void ownerId;
  const cached = memory.get(CORPORATE_STORE_ID);
  if (cached) return cached;
  return empty(CORPORATE_STORE_ID);
}

export function subscribeGoogleStore(ownerId: string, listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  function handler() {
    listener();
  }
  void ownerId;
  window.addEventListener(CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(CHANGED_EVENT, handler);
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
    const message = "Não foi possível verificar a Conta Google corporativa agora.";
    void err;
    const next: GoogleStore = { ...getGoogleStore(ownerId), state: "error", error: message };
    write(next);
    return next;
  }
}

/** Conta Google conectada quando os serviços essenciais respondem. */
export function isGoogleAccountConnected(store: GoogleStore): boolean {
  return store.connectors.some((c) => c.connected);
}

/** Serviços da conta que ainda não foram autorizados. */
export function missingGoogleConnectors(store: GoogleStore): GoogleConnectorKey[] {
  return GOOGLE_ACCOUNT_CONNECTORS.filter((id) => !isConnectorConnected(store, id));
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
    return setConnectError(owner, friendlyGoogleMessage(err));
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
    details: "Autenticação OAuth 2.0 concluída com credencial corporativa persistida pelo Portal.",
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

/**
 * Pareamento único da CONTA GOOGLE: autoriza, em sequência, todos os
 * serviços da mesma conta (Calendar/Meet, Drive e Gmail). Depois do
 * primeiro pareamento a credencial permanece válida — a renovação por
 * refresh token é feita pelo gateway seguro, sem novo login.
 */
export async function connectGoogleAccount(actor: ConnectActor): Promise<GoogleStore> {
  let store = await refreshGoogleStore(actor.userId);
  for (const connectorId of missingGoogleConnectors(store)) {
    store = await startConnect(actor, connectorId);
    if (store.state === "error") return store;
  }
  return store;
}

/** Desfaz o pareamento completo da Conta Google. */
export async function disconnectGoogleAccount(actor: ConnectActor): Promise<GoogleStore> {
  let store = getGoogleStore(actor.userId);
  for (const connectorId of GOOGLE_ACCOUNT_CONNECTORS) {
    if (isConnectorConnected(store, connectorId)) {
      store = await disconnect(actor, connectorId);
    }
  }
  return refreshGoogleStore(actor.userId);
}