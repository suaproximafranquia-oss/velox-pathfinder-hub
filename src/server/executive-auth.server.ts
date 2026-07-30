/** Provisionamento das contas de acesso dos executivos — SERVER ONLY. */
import { SEED_USERS } from "@/lib/executive-auth";

export type OfficialUser = {
  executiveId: string;
  email: string;
  name: string;
  password: string;
};

export function findOfficialUser(email: string, password: string): OfficialUser | null {
  const key = email.trim().toLowerCase();
  const user = SEED_USERS.find(
    (u) => u.email.toLowerCase() === key && u.password === password && u.status === "ativo",
  );
  if (!user) return null;
  return {
    executiveId: user.id,
    email: user.email,
    name: user.name,
    password: user.password,
  };
}

/**
 * Garante a existência da conta autenticada correspondente ao executivo
 * oficial e devolve o identificador permanente do usuário.
 */
export async function ensureAuthUser(user: OfficialUser): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile } = await supabaseAdmin
    .from("executive_profiles")
    .select("user_id")
    .eq("executive_id", user.executiveId)
    .maybeSingle();

  let userId = (profile?.user_id as string | undefined) ?? undefined;

  if (!userId) {
    const created = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, executive_id: user.executiveId },
    });
    if (created.data.user) {
      userId = created.data.user.id;
    } else {
      // Conta já existente — localiza pelo e-mail.
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = list.data.users.find(
        (u) => (u.email ?? "").toLowerCase() === user.email.toLowerCase(),
      );
      if (!match) throw new Error(created.error?.message ?? "Falha ao provisionar o acesso.");
      userId = match.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: user.password });
    }
  }

  await supabaseAdmin.from("executive_profiles").upsert(
    {
      user_id: userId,
      executive_id: user.executiveId,
      email: user.email,
      name: user.name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return userId;
}