import { createServerFn } from "@tanstack/react-start";

/**
 * Provisiona (idempotente) a conta autenticada do executivo oficial para
 * que o login local passe a ter uma sessão real no backend.
 *
 * §13 — o servidor também é quem decide se o acesso ainda existe: um
 * usuário desativado tem o login recusado aqui, antes de qualquer
 * sessão ser aberta.
 */
export const ensureExecutiveAuthUser = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { ensureAuthUser, findOfficialUser } = await import("@/server/executive-auth.server");
    const official = findOfficialUser(data.email, data.password);
    if (!official) return { ok: false as const, reason: "credenciais" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("executive_user_status")
      .select("status")
      .eq("executive_id", official.executiveId)
      .maybeSingle();
    if (row?.status === "inativo") {
      return { ok: false as const, reason: "inativo" as const };
    }

    const userId = await ensureAuthUser(official);
    return { ok: true as const, userId, executiveId: official.executiveId };
  });
