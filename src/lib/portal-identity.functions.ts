/**
 * BLOCO 2 — IDENTIDADE E RETORNO DO LEAD.
 *
 * A identidade do investidor pertence ao CADASTRO NO SERVIDOR, nunca ao
 * navegador. Esta camada é a ÚNICA autoridade para decidir "novo" x
 * "recorrente" e para criar o identificador do investidor.
 *
 * A operação inteira (consultar → decidir → criar/reaproveitar) roda
 * dentro de uma única função transacional no banco
 * (`public.resolve_portal_identity`), com trava exclusiva derivada da
 * chave normalizada — duas requisições simultâneas com a mesma
 * identidade jamais criam dois cadastros.
 *
 * SEGURANÇA: a resposta pública devolve SOMENTE o mínimo necessário para
 * continuar a sessão. Nome, cidade, executivo, escopo comercial,
 * histórico, mensagens e jornada NUNCA são devolvidos ao visitante.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IdentityInput = {
  name: string;
  email: string;
  phone: string;
  origin?: string | null;
  material?: string | null;
  scope?: "green_sales" | "portal" | "tiktok" | "meta" | null;
  executiveId?: string | null;
  executiveSlug?: string | null;
  personalized?: boolean | null;
  campaign?: string | null;
  device?: string | null;
  city?: string | null;
};

export type IdentityResult =
  | { ok: true; investorId: string; recognized: boolean }
  | { ok: false; reason: "identity_invalid" | "identity_unresolved" | "server_error" };

/** Chave oficial de telefone do caminho de identidade do Portal. */
export function portalPhoneKey(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D+/g, "");
  if (digits.length < 10) return null;
  return digits.length > 11 ? digits.slice(-11) : digits;
}

/** Chave oficial de e-mail do caminho de identidade do Portal. */
export function portalEmailKey(email?: string | null): string | null {
  const value = (email ?? "").trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(value) ? value : null;
}

/**
 * Reconhecimento SEM efeito colateral: usado para decidir a tela de
 * "Bem-vindo novamente" pelo servidor, e não pelo navegador. Não cria
 * cadastro e não devolve nenhum dado do investidor.
 */
export const recognizePortalIdentity = createServerFn({ method: "POST" })
  .inputValidator((data: { email?: string; phone?: string }) => data)
  .handler(async ({ data }): Promise<{ recognized: boolean }> => {
    const phoneKey = portalPhoneKey(data.phone);
    const emailKey = portalEmailKey(data.email);
    if (!phoneKey && !emailKey) return { recognized: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (phoneKey) {
      const { data: rows } = await supabaseAdmin
        .from("portal_leads")
        .select("id,whatsapp")
        .ilike("whatsapp", `%${phoneKey.slice(-8)}%`)
        .limit(50);
      if ((rows ?? []).some((row) => portalPhoneKey(row.whatsapp) === phoneKey)) {
        return { recognized: true };
      }
    }
    if (emailKey) {
      const { data: rows } = await supabaseAdmin
        .from("portal_leads")
        .select("id")
        .eq("email", emailKey)
        .limit(1);
      if ((rows ?? []).length > 0) return { recognized: true };
    }
    return { recognized: false };
  });


export const resolvePortalIdentity = createServerFn({ method: "POST" })
  .inputValidator((data: IdentityInput) => data)
  .handler(async ({ data }): Promise<IdentityResult> => {
    const phoneKey = portalPhoneKey(data.phone);
    const emailKey = portalEmailKey(data.email);
    if (!phoneKey && !emailKey) return { ok: false, reason: "identity_invalid" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("resolve_portal_identity", {
      _name: (data.name ?? "").trim(),
      _email: emailKey ?? "",
      _phone: (data.phone ?? "").trim(),
      _origin: data.origin ?? "Portal Velox",
      _material: data.material ?? "",
      _scope: data.scope ?? "portal",
      _executive_id: data.executiveId ?? null,
      _executive_slug: data.executiveSlug ?? null,
      _personalized: Boolean(data.personalized && data.executiveId),
      _campaign: data.campaign ?? null,
      _device: data.device ?? null,
      _city: data.city ?? "",
    } as never);

    if (error) {
      console.error("[portal-identity] falha na resolução de identidade:", error.message);
      return { ok: false, reason: "server_error" };
    }

    /**
     * COMPATIBILIDADE DE CONTRATO — a função oficial em produção devolve
     * `investorId`/`recognized`; versões anteriores devolviam
     * `leadId`/`created`. Lemos as duas formas para que o cadastro NUNCA
     * seja descartado como "identity_unresolved". Nenhuma regra de
     * identidade, deduplicação ou E0 muda por isso.
     */
    const raw = (result ?? {}) as {
      ok?: boolean;
      leadId?: string;
      investorId?: string;
      created?: boolean;
      recognized?: boolean;
      reason?: string;
    };
    const payload = {
      ok: raw.ok,
      leadId: raw.leadId ?? raw.investorId,
      created: raw.created ?? (raw.recognized === undefined ? undefined : !raw.recognized),
      reason: raw.reason,
    };
    if (!payload.ok || !payload.leadId) {
      return {
        ok: false,
        reason: payload.reason === "identity_invalid" ? "identity_invalid" : "identity_unresolved",
      };
    }

    /**
     * Primeiro contato oficial só é avaliado quando o cadastro NASCE
     * aqui — a regra e a idempotência continuam sendo do motor.
     */
    if (payload.created) {
      try {
        const { kickoffPortalFirstContact } = await import(
          "@/server/crm/portal-first-contact.server"
        );
        await kickoffPortalFirstContact({
          leadId: payload.leadId,
          name: (data.name ?? "").trim(),
          phone: (data.phone ?? "").trim(),
          scope: (data.scope ?? "portal") as "green_sales" | "portal" | "tiktok" | "meta",
          ownerId: data.executiveId ?? null,
          entryAt: new Date().toISOString(),
        });
      } catch (kickoffError) {
        console.error(
          "[portal-identity] primeiro contato não pôde ser avaliado:",
          kickoffError instanceof Error ? kickoffError.message : kickoffError,
        );
      }
    }

    // Auditoria da entrada — nunca devolvida ao visitante.
    try {
      await supabaseAdmin.from("portal_journey_events").insert({
        investor_id: payload.leadId,
        event: payload.created ? "identity.created" : "identity.recognized",
        module: "portal",
        detail: payload.created
          ? "Cadastro criado pelo servidor após resolução de identidade."
          : "Investidor reconhecido pelo servidor (telefone/e-mail) — sem duplicação.",
      } as never);
    } catch {
      /* auditoria nunca bloqueia a jornada */
    }

    return {
      ok: true,
      investorId: payload.leadId,
      recognized: !payload.created,
    };
  });

/**
 * Fila de pendências de identidade — somente equipe autenticada.
 * Nenhum conflito é resolvido automaticamente: esta é a visão de
 * revisão manual da gestão.
 */
export const listIdentityConflicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("portal_leads")
      .select("id,name,email,whatsapp,identity_conflict,identity_alternates,updated_at")
      .not("identity_conflict", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * PRECEDÊNCIA DA CORREÇÃO MANUAL (§6).
 *
 * A estrutura existente `manual_overrides` continua sendo a ÚNICA fonte
 * de precedência. Quando o executivo corrige nome, e-mail, telefone ou
 * cidade, o campo é marcado aqui e o Portal deixa de sobrescrevê-lo.
 */
export const markManualOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; fields: string[]; actor?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const allowed = ["name", "email", "whatsapp", "city"];
    const fields = data.fields.filter((field) => allowed.includes(field));
    if (fields.length === 0) return { ok: true as const, fields: [] as string[] };

    const { data: row, error: readError } = await context.supabase
      .from("portal_leads")
      .select("manual_overrides")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    const current = (row?.manual_overrides ?? {}) as Record<string, unknown>;
    const at = new Date().toISOString();
    const next = { ...current };
    for (const field of fields) {
      next[field] = { locked: true, at, by: data.actor ?? context.userId };
    }
    const { error } = await context.supabase
      .from("portal_leads")
      .update({ manual_overrides: next as never })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, fields };
  });
