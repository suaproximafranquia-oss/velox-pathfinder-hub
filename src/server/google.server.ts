/**
 * Ponte com o Google Workspace (Calendar/Meet, Drive e Gmail) — SERVER ONLY.
 *
 * O Portal Velox possui UMA única Conta Google corporativa: toda chamada
 * (agenda, reuniões, arquivos e e-mails) usa a mesma credencial, guardada
 * sob o proprietário corporativo. Nenhum token trafega para o navegador.
 */
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import {
  findAnyConnection,
  getConnectionKeyForUser,
  promoteConnectionToOwner,
} from "@/server/appUserConnections.server";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

/**
 * Proprietário técnico da Conta Google corporativa. Não corresponde a um
 * executivo — é o identificador único da conta compartilhada do Portal.
 */
export const CORPORATE_OWNER_ID = "00000000-0000-4000-8000-000000000001";

export type GoogleConnectorId = "google_calendar" | "google_drive" | "google_mail";

export const GOOGLE_CONNECTORS: readonly GoogleConnectorId[] = [
  "google_calendar",
  "google_drive",
  "google_mail",
];

const BASE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const GOOGLE_SCOPES_BY_CONNECTOR: Record<GoogleConnectorId, string[]> = {
  google_calendar: [
    ...BASE_SCOPES,
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ],
  google_drive: [...BASE_SCOPES, "https://www.googleapis.com/auth/drive.file"],
  google_mail: [...BASE_SCOPES, "https://www.googleapis.com/auth/gmail.send"],
};

export function clientApiKeyFor(connectorId: GoogleConnectorId): string {
  const envName = `${connectorId.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`;
  const value = process.env[envName];
  if (!value) throw new Error(`${envName} não está configurada no projeto.`);
  return value;
}

export function isGoogleConnector(value: string): value is GoogleConnectorId {
  return (GOOGLE_CONNECTORS as readonly string[]).includes(value);
}

/**
 * Credencial da Conta Google corporativa. Conexões individuais anteriores
 * continuam funcionando como retrocompatibilidade enquanto a conta
 * corporativa não estiver pareada.
 */
export async function resolveCorporateKey(
  connectorId: GoogleConnectorId,
  legacyUserId?: string,
): Promise<string | null> {
  const corporate = await getConnectionKeyForUser(CORPORATE_OWNER_ID, connectorId);
  if (corporate) return corporate;
  void legacyUserId;
  // Credencial antiga vinculada a um executivo: promove para a conta
  // corporativa e passa a valer para todos os usuários do Portal.
  const legacy = await findAnyConnection(connectorId);
  if (!legacy) return null;
  await promoteConnectionToOwner(legacy.userId, CORPORATE_OWNER_ID, connectorId);
  return legacy.key;
}

/** Chamada autenticada ao Google via gateway. Lança com o corpo do erro. */
export async function googleFetch(
  userId: string,
  connectorId: GoogleConnectorId,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const connectionAPIKey = await resolveCorporateKey(connectorId, userId);
  if (!connectionAPIKey) {
    throw new Error(`GOOGLE_NOT_CONNECTED:${connectorId}`);
  }
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId,
    path,
    init: { ...init, headers },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Google ${connectorId} ${path} falhou [${res.status}]: ${text}`);
    if (res.status === 401 || res.status === 403) {
      if (/refresh_token_expired|invalid_grant|must re-authorize|credential_not_found/i.test(text)) {
        throw new Error(`GOOGLE_REAUTH_REQUIRED:${connectorId}`);
      }
    }
    throw new Error(`GOOGLE_API_ERROR:${res.status}:${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Erros do gateway que exigem um novo consentimento OAuth do Google. */
export function isReauthPayload(status: number, body: string): boolean {
  if (status !== 401 && status !== 403) return false;
  return /refresh_token_expired|invalid_grant|must re-authorize|credential_not_found|unauthorized_client|invalid_credentials/i.test(
    body,
  );
}

export type ProbeResult = {
  connectorId: GoogleConnectorId;
  /** Só é `true` quando a API do Google respondeu com sucesso agora. */
  ok: boolean;
  reason: "ok" | "missing_credential" | "reauth_required" | "api_error" | "gateway_error";
  httpStatus: number | null;
  accountEmail: string | null;
  detail: string | null;
};

/** Endpoint leve e representativo de cada serviço, usado na validação real. */
const PROBE_PATH: Record<GoogleConnectorId, string> = {
  google_calendar: "/calendar/v3/users/me/calendarList?maxResults=1",
  google_drive: "/drive/v3/about?fields=user(emailAddress)",
  google_mail: "/gmail/v1/users/me/profile",
};

function emailFromProbe(connectorId: GoogleConnectorId, payload: unknown): string | null {
  const data = payload as Record<string, unknown> | null;
  if (!data) return null;
  if (connectorId === "google_drive") {
    const user = data['user'] as { emailAddress?: string } | undefined;
    return user?.emailAddress ?? null;
  }
  if (connectorId === "google_mail") return (data['emailAddress'] as string | undefined) ?? null;
  const items = data['items'] as Array<{ id?: string; primary?: boolean }> | undefined;
  const primary = items?.find((i) => i.primary) ?? items?.[0];
  return primary?.id ?? null;
}

const PROBE_TTL_MS = 45_000;
const probeCache = new Map<GoogleConnectorId, { at: number; result: ProbeResult }>();

/**
 * Valida a credencial corporativa fazendo UMA chamada real à API do Google.
 * É a única fonte de verdade do estado "Conectado" — a existência de uma
 * linha no banco nunca basta.
 */
export async function probeConnection(
  connectorId: GoogleConnectorId,
  options?: { force?: boolean },
): Promise<ProbeResult> {
  const cached = probeCache.get(connectorId);
  if (!options?.force && cached && Date.now() - cached.at < PROBE_TTL_MS) return cached.result;

  const finish = (result: ProbeResult) => {
    probeCache.set(connectorId, { at: Date.now(), result });
    return result;
  };

  const connectionAPIKey = await resolveCorporateKey(connectorId);
  if (!connectionAPIKey) {
    return finish({
      connectorId,
      ok: false,
      reason: "missing_credential",
      httpStatus: null,
      accountEmail: null,
      detail: "Nenhuma credencial corporativa autorizada para este serviço.",
    });
  }

  try {
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId,
      path: PROBE_PATH[connectorId],
    });
    const text = await res.text();
    if (res.ok) {
      const payload = text ? (JSON.parse(text) as unknown) : null;
      return finish({
        connectorId,
        ok: true,
        reason: "ok",
        httpStatus: res.status,
        accountEmail: emailFromProbe(connectorId, payload),
        detail: null,
      });
    }
    if (isReauthPayload(res.status, text)) {
      return finish({
        connectorId,
        ok: false,
        reason: "reauth_required",
        httpStatus: res.status,
        accountEmail: null,
        detail:
          "A autorização do Google expirou ou foi revogada. É necessário reconectar a Conta Google do Portal.",
      });
    }
    console.error(`Google probe ${connectorId} falhou [${res.status}]: ${text.slice(0, 300)}`);
    return finish({
      connectorId,
      ok: false,
      reason: "api_error",
      httpStatus: res.status,
      accountEmail: null,
      detail: `O Google recusou a verificação (código ${res.status}).`,
    });
  } catch (err) {
    return finish({
      connectorId,
      ok: false,
      reason: "gateway_error",
      httpStatus: null,
      accountEmail: null,
      detail:
        err instanceof Error && /LOVABLE_API_KEY/.test(err.message)
          ? "Credencial de servidor do Portal ausente (LOVABLE_API_KEY)."
          : "Não foi possível falar com o Google agora.",
    });
  }
}

/** Invalida o cache de validação (após conectar/desconectar). */
export function clearProbeCache(connectorId?: GoogleConnectorId) {
  if (connectorId) probeCache.delete(connectorId);
  else probeCache.clear();
}

/** Perfil da conta Google conectada (usado no card de integrações). */
export async function fetchGoogleProfile(
  userId: string,
  connectorId: GoogleConnectorId,
): Promise<{ email: string | null; name: string | null; picture: string | null }> {
  const data = (await googleFetch(userId, connectorId, "/oauth2/v2/userinfo")) as {
    email?: string;
    name?: string;
    picture?: string;
  } | null;
  return {
    email: data?.email ?? null,
    name: data?.name ?? null,
    picture: data?.picture ?? null,
  };
}