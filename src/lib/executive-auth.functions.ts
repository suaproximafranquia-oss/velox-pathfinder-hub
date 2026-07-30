import { createServerFn } from "@tanstack/react-start";

/**
 * Provisiona (idempotente) a conta autenticada do executivo oficial para
 * que o login local passe a ter uma sessão real no backend.
 */
export const ensureExecutiveAuthUser = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { ensureAuthUser, findOfficialUser } = await import("@/server/executive-auth.server");
    const official = findOfficialUser(data.email, data.password);
    if (!official) return { ok: false as const };
    const userId = await ensureAuthUser(official);
    return { ok: true as const, userId, executiveId: official.executiveId };
  });