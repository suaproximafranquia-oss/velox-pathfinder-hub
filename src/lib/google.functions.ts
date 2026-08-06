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

/** Situação da Conta Google corporativa (mesma conta para todos). */
export const getGoogleConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleConnectionStatus[]> => {
    const { GOOGLE_CONNECTORS, CORPORATE_OWNER_ID } = await import("@/server/google.server");
    const { listConnectionsForUser, findAnyConnection, promoteConnectionToOwner } = await import(
      "@/server/appUserConnections.server"
    );
    void context;
    const corporate = await listConnectionsForUser(CORPORATE_OWNER_ID);
    const result: GoogleConnectionStatus[] = [];
    for (const connectorId of GOOGLE_CONNECTORS) {
      let row = corporate.find((s) => s.connectorId === connectorId) ?? null;
      if (!row) {
        // Conexão legada de um executivo: promove para a conta do Portal
        // para que TODOS os usuários vejam o Google conectado.
        const legacy = await findAnyConnection(connectorId);
        if (legacy) {
          await promoteConnectionToOwner(legacy.userId, CORPORATE_OWNER_ID, connectorId);
          row = {
            connectorId,
            accountEmail: legacy.accountEmail,
            updatedAt: legacy.updatedAt,
          };
        }
      }
      result.push({
        connectorId,
        connected: Boolean(row),
        accountEmail: row?.accountEmail ?? null,
        updatedAt: row?.updatedAt ?? null,
      });
    }
    return result;
  });

/** Inicia o consentimento OAuth 2.0 oficial do Google. */
export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connectorId: GoogleConnectorKey }) => data)
  .handler(async ({ data, context }) => {
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const {
      GATEWAY_BASE_URL,
      GOOGLE_SCOPES_BY_CONNECTOR,
      clientApiKeyFor,
      isGoogleConnector,
      CORPORATE_OWNER_ID,
    } = await import("@/server/google.server");
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { assertGoogleAccountManager } = await import("@/server/executive-auth.server");

    if (!isGoogleConnector(data.connectorId)) throw new Error("Conector inválido.");
    await assertGoogleAccountManager(context.userId);
    const request = getRequest();
    if (!request) throw new Error("A conexão precisa começar por uma requisição da aplicação.");
    const returnUrl = new URL(`/oauth/google/${data.connectorId}`, request.url).toString();
    const existing = await getConnectionKeyForUser(CORPORATE_OWNER_ID, data.connectorId);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: data.connectorId,
      appUserId: CORPORATE_OWNER_ID,
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
    const { GATEWAY_BASE_URL, fetchGoogleProfile, isGoogleConnector, CORPORATE_OWNER_ID } =
      await import("@/server/google.server");
    const { saveConnectionKeyForUser, setConnectionAccountEmail } = await import(
      "@/server/appUserConnections.server"
    );
    const { assertGoogleAccountManager } = await import("@/server/executive-auth.server");
    await assertGoogleAccountManager(context.userId);

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (!isGoogleConnector(connectorId)) throw new Error("Conector inesperado no retorno OAuth.");
    await saveConnectionKeyForUser(CORPORATE_OWNER_ID, connectorId, connectionAPIKey);

    let email: string | null = null;
    try {
      const profile = await fetchGoogleProfile(CORPORATE_OWNER_ID, connectorId);
      email = profile.email;
      if (email) await setConnectionAccountEmail(CORPORATE_OWNER_ID, connectorId, email);
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
    const { GATEWAY_BASE_URL, CORPORATE_OWNER_ID } = await import("@/server/google.server");
    const { deleteConnectionForUser, getConnectionKeyForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const { assertGoogleAccountManager } = await import("@/server/executive-auth.server");
    await assertGoogleAccountManager(context.userId);
    const key = await getConnectionKeyForUser(CORPORATE_OWNER_ID, data.connectorId);
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
    await deleteConnectionForUser(CORPORATE_OWNER_ID, data.connectorId);
    await deleteConnectionForUser(context.userId, data.connectorId);
    return { ok: true as const };
  });