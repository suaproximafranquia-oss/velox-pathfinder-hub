/**
 * Ponte com o Google Workspace (Calendar/Meet, Drive e Gmail) — SERVER ONLY.
 *
 * O Portal Velox possui UMA única Conta Google corporativa: toda chamada
 * (agenda, reuniões, arquivos e e-mails) usa a mesma credencial, guardada
 * sob o proprietário corporativo. Nenhum token trafega para o navegador.
 */
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getConnectionKeyForUser } from "@/server/appUserConnections.server";

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
    throw new Error(`GOOGLE_API_ERROR:${res.status}:${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
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