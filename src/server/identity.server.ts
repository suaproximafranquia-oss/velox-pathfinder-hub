/**
 * IDENTIDADE SERVER-SIDE OFICIAL — CADEIA ÚNICA.
 *
 * Toda operação do servidor que precisa saber "quem é este usuário"
 * resolve a MESMA cadeia, sem nenhuma fonte paralela e sem nada vindo
 * do navegador:
 *
 *   Supabase Auth user.id
 *     → executive_profiles.user_id
 *     → executive_profiles.executive_id
 *     → dados do executivo (WhatsApp, slug, GreenSales vendor_id…)
 *
 *   Supabase Auth user.id → user_roles.role            (papel)
 *   executive_id          → executive_user_status      (situação)
 *
 * Nenhuma tabela nova é criada e nenhum dado é duplicado: este módulo
 * apenas LÊ o cadastro já existente.
 */

export type SecurityRole = "admin" | "manager" | "user";

export type ServerIdentity = {
  userId: string;
  executiveId: string | null;
  name: string | null;
  email: string | null;
  slug: string | null;
  /** Fonte oficial do WhatsApp do executivo (nunca o navegador). */
  whatsapp: string | null;
  /** Vendedor GreenSales vinculado ao executivo autenticado. */
  greensalesVendorId: string | null;
  /** Papel de segurança — `user_roles`, jamais o cache da interface. */
  role: SecurityRole;
  status: "ativo" | "inativo";
};

type ProfileRow = {
  executive_id: string | null;
  name: string | null;
  email: string | null;
  slug: string | null;
  whatsapp: string | null;
  greensales_vendor_id: string | null;
};

/** Resolve a identidade completa do usuário autenticado. */
export async function resolveServerIdentity(userId: string): Promise<ServerIdentity> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile } = await supabaseAdmin
    .from("executive_profiles")
    .select("executive_id,name,email,slug,whatsapp,greensales_vendor_id")
    .eq("user_id", userId)
    .maybeSingle();

  const row = (profile ?? null) as ProfileRow | null;
  const executiveId = row?.executive_id ?? null;

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const granted = new Set(
    ((roles ?? []) as { role: string }[]).map((r) => r.role),
  );
  const role: SecurityRole = granted.has("admin")
    ? "admin"
    : granted.has("manager")
      ? "manager"
      : "user";

  let status: "ativo" | "inativo" = "ativo";
  if (executiveId) {
    const { data: statusRow } = await supabaseAdmin
      .from("executive_user_status")
      .select("status")
      .eq("executive_id", executiveId)
      .maybeSingle();
    if ((statusRow as { status?: string } | null)?.status === "inativo") {
      status = "inativo";
    }
  }

  return {
    userId,
    executiveId,
    name: row?.name ?? null,
    email: row?.email ?? null,
    slug: row?.slug ?? null,
    whatsapp: row?.whatsapp ?? null,
    greensalesVendorId: row?.greensales_vendor_id ?? null,
    role,
    status,
  };
}

/** Executivo (executive_id) do usuário autenticado — atalho da cadeia. */
export async function resolveExecutiveIdForUser(userId: string): Promise<string | null> {
  const identity = await resolveServerIdentity(userId);
  return identity.executiveId;
}

/** Vendedor GreenSales do executivo autenticado (sem cadastro paralelo). */
export async function resolveGreensalesVendorIdForUser(
  userId: string,
): Promise<string | null> {
  const identity = await resolveServerIdentity(userId);
  return identity.greensalesVendorId;
}

/** WhatsApp oficial do executivo autenticado (fonte única do cadastro). */
export async function resolveExecutiveWhatsappForUser(
  userId: string,
): Promise<string | null> {
  const identity = await resolveServerIdentity(userId);
  return identity.whatsapp;
}
