import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/**
 * IDENTIDADE OFICIAL DO USUÁRIO AUTENTICADO.
 *
 * Cadeia única: Auth user.id → executive_profiles.user_id → executive_id
 * → dados do executivo; papel em `user_roles`; situação em
 * `executive_user_status`. O navegador não substitui nada disto.
 */
export const identidadeDoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveServerIdentity } = await import("@/server/identity.server");
    const identity = await resolveServerIdentity(context.userId);
    return {
      userId: identity.userId,
      executiveId: identity.executiveId,
      name: identity.name,
      email: identity.email,
      slug: identity.slug,
      whatsapp: identity.whatsapp,
      greensalesVendorId: identity.greensalesVendorId,
      role: identity.role,
      status: identity.status,
    };
  });

/**
 * Provisiona a CONTA DE ACESSO de um usuário criado na Gestão de
 * Usuários. A senha existe apenas no mecanismo de autenticação — nunca
 * no navegador e nunca na ficha do executivo.
 *
 * Preservação: usuários existentes não são recriados nem têm IDs,
 * vendor_id, WhatsApp ou permissões alterados.
 */
export const provisionarAcessoExecutivo = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      executiveId: string;
      email: string;
      name: string;
      password: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!email || !data.executiveId || data.password.length < 6) {
      return { ok: false as const, reason: "dados" as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // PRESERVAÇÃO: um executivo já cadastrado nunca é recriado nem tem a
    // senha redefinida por esta rota.
    const { data: existing } = await supabaseAdmin
      .from("executive_profiles")
      .select("executive_id")
      .or(`executive_id.eq.${data.executiveId},email.eq.${email}`)
      .maybeSingle();
    if (existing) return { ok: false as const, reason: "ja_existe" as const };

    const { ensureAuthUser } = await import("@/server/executive-auth.server");
    try {
      const userId = await ensureAuthUser({
        executiveId: data.executiveId,
        email,
        name: data.name,
        password: data.password,
      });
      return { ok: true as const, userId };
    } catch {
      return { ok: false as const, reason: "provisionamento" as const };
    }
  });
