import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GoogleConnectorKey = "google_calendar" | "google_drive" | "google_mail";

export type GoogleConnectionStatus = {
  connectorId: GoogleConnectorKey;
  connected: boolean;
  accountEmail: string | null;
  updatedAt: string | null;
};

/** Situação das três integrações Google do executivo autenticado. */
export const getGoogleConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleConnectionStatus[]> => {
    const { GOOGLE_CONNECTORS } = await import("@/server/google.server");
    const { listConnectionsForUser } = await import("@/server/appUserConnections.server");
    const stored = await listConnectionsForUser(context.userId);
    return GOOGLE_CONNECTORS.map((connectorId) => {
      const row = stored.find((s) => s.connectorId === connectorId);
      return {
        connectorId,
        connected: Boolean(row),
        accountEmail: row?.accountEmail ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  });

/** Inicia o consentimento OAuth 2.0 oficial do Google. */
export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connectorId: GoogleConnectorKey }) => data)
  .handler(async ({ data, context }) => {
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, GOOGLE_SCOPES_BY_CONNECTOR, clientApiKeyFor, isGoogleConnector } =
      await import("@/server/google.server");
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");

    if (!isGoogleConnector(data.connectorId)) throw new Error("Conector inválido.");
    const request = getRequest();
    if (!request) throw new Error("A conexão precisa começar por uma requisição da aplicação.");
    const returnUrl = new URL(`/oauth/google/${data.connectorId}`, request.url).toString();
    const existing = await getConnectionKeyForUser(context.userId, data.connectorId);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: data.connectorId,
      appUserId: context.userId,
      clientAPIKey: clientApiKeyFor(data.connectorId),
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: GOOGLE_SCOPES_BY_CONNECTOR[data.connectorId] },
    });
    return { authorizationUrl };
  });

/** Conclui o consentimento: troca o código e persiste a credencial. */
export const completeGoogleConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, fetchGoogleProfile, isGoogleConnector } = await import(
      "@/server/google.server"
    );
    const { saveConnectionKeyForUser, setConnectionAccountEmail } = await import(
      "@/server/appUserConnections.server"
    );

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (!isGoogleConnector(connectorId)) throw new Error("Conector inesperado no retorno OAuth.");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);

    let email: string | null = null;
    try {
      const profile = await fetchGoogleProfile(context.userId, connectorId);
      email = profile.email;
      if (email) await setConnectionAccountEmail(context.userId, connectorId, email);
    } catch {
      /* perfil é complementar — nunca bloqueia a conexão */
    }
    return { ok: true as const, connectorId, accountEmail: email };
  });

/** Remove a credencial no gateway e localmente. */
export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connectorId: GoogleConnectorKey }) => data)
  .handler(async ({ data, context }) => {
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL } = await import("@/server/google.server");
    const { deleteConnectionForUser, getConnectionKeyForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const key = await getConnectionKeyForUser(context.userId, data.connectorId);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: data.connectorId,
        });
      } catch {
        /* segue removendo localmente */
      }
    }
    await deleteConnectionForUser(context.userId, data.connectorId);
    return { ok: true as const };
  });