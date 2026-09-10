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
  unit?: "f";
  /** Só formulário submetido; reconhecer/continuar sessão não é nova entrada. */
  commercialSubmission?: { id: string; unit: "f" };
};

/**
 * Mínimo oficial devolvido a um investidor JÁ RECONHECIDO para que a
 * sessão do Portal seja montada a partir do cadastro, e não do cache do
 * navegador. Não contém histórico, mensagens nem escopo comercial.
 */
export type RecognizedSession = {
  name: string;
  email: string;
  responsibleExecutiveId: string | null;
  responsibleExecutiveSlug: string | null;
  origin: string | null;
  personalized: boolean;
  /** Credencial assinada do tracking — só quando o identificador confere. */
  token: string | null;
};

export type IdentityResult =
  | { ok: true; investorId: string; recognized: boolean; session?: RecognizedSession }
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

    // A RPC já preserva os contatos principais; /f também conserva o nome
    // digitado como alternativa, sem promover esse valor ao cadastro oficial.
    if ((data.unit === "f" || data.commercialSubmission?.unit === "f") && !payload.created) {
      const { data: official, error: readError } = await supabaseAdmin.from("portal_leads")
        .select("name,identity_alternates").eq("id", payload.leadId).maybeSingle();
      if (readError) return { ok: false, reason: "server_error" };
      const name = (data.name ?? "").trim();
      if (official && name && name !== official.name) {
        const alternates = (official.identity_alternates ?? {}) as Record<string, unknown[]>;
        const names = Array.isArray(alternates.name) ? alternates.name : [];
        if (!names.some((item) => (item as { value?: unknown })?.value === name)) {
          const { error: alternateError } = await supabaseAdmin.from("portal_leads")
            .update({ identity_alternates: { ...alternates, name: [...names, { value: name, source: "portal", at: new Date().toISOString() }] } as never })
            .eq("id", payload.leadId);
          if (alternateError) return { ok: false, reason: "server_error" };
        }
      }
    }

    /**
     * Primeiro contato oficial só é avaliado quando o cadastro NASCE
     * aqui — a regra e a idempotência continuam sendo do motor.
     */
    let submissionCreated: boolean | null = null;
    let submissionAt: string | null = null;
    if (data.commercialSubmission?.unit === "f" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.commercialSubmission.id)
      && (data.name ?? "").trim().length >= 2 && phoneKey && emailKey) {
      // PK já existente da jornada: duas tentativas conservam o primeiro fato (novo/conhecido).
      const id = data.commercialSubmission.id;
      const { error: entryError } = await supabaseAdmin.from("portal_journey_events").upsert({
        id, investor_id: payload.leadId, event: "commercial.submitted", module: "portal",
        detail: payload.created ? "first_entry" : "reentry",
      }, { onConflict: "id", ignoreDuplicates: true });
      if (entryError) return { ok: false, reason: "server_error" };
      const { data: entry, error: readError } = await supabaseAdmin.from("portal_journey_events")
        .select("investor_id,event,detail,created_at").eq("id", id).maybeSingle();
      if (readError || entry?.investor_id !== payload.leadId || entry.event !== "commercial.submitted") return { ok: false, reason: "server_error" };
      submissionCreated = entry.detail === "first_entry";
      submissionAt = entry.created_at;
      /**
       * REENTRADA (RE) — REGRA FECHADA: o ciclo RE nasce EXCLUSIVAMENTE
       * de uma NOVA ENTRADA COMERCIAL recebida da GreenSales (caminho
       * `intakeLead` → `createPendingE0Action({ reentry: true })`).
       * Nenhum evento do Portal — formulário, retorno, Manual, Material,
       * Calculadora, link cru ou personalizado — abre ou infere RE.
       * Aqui o Portal apenas registra a submissão e a identidade.
       */
    }
    if (submissionCreated === true || (submissionCreated === null && payload.created)) {
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
          entryAt: submissionAt ?? new Date().toISOString(),
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

    /**
     * SESSÃO DO RECONHECIDO (/f) — o servidor devolve o mínimo oficial
     * para montar a sessão sem depender do cache do navegador. O nome
     * digitado NUNCA substitui o cadastro; responsável, origem e
     * histórico permanecem exatamente como já estavam.
     */
    let session: RecognizedSession | undefined;
    if (data.unit === "f" && !payload.created) {
      const { data: official } = await supabaseAdmin
        .from("portal_leads")
        .select("id,name,email,whatsapp,origin,personalized,responsible_executive_id,responsible_executive_slug")
        .eq("id", payload.leadId)
        .maybeSingle();
      if (official) {
        /**
         * Reconhecer não autoriza por si só: a credencial só é emitida
         * quando um identificador FORTE informado confere com o cadastro
         * oficial (mesma verificação usada na emissão do token).
         */
        const emailMatches =
          Boolean(emailKey) && (official.email ?? "").trim().toLowerCase() === emailKey;
        const phoneMatches =
          Boolean(phoneKey) && portalPhoneKey(official.whatsapp) === phoneKey;
        let token: string | null = null;
        if (emailMatches || phoneMatches) {
          try {
            const { issueToken } = await import("@/server/portal-token.server");
            token = await issueToken(official.id);
          } catch {
            token = null;
          }
        }
        session = {
          name: official.name,
          email: official.email ?? "",
          responsibleExecutiveId: official.responsible_executive_id ?? null,
          responsibleExecutiveSlug: official.responsible_executive_slug ?? null,
          origin: official.origin ?? null,
          personalized: Boolean(official.personalized),
          token,
        };
      }
    }

    return {
      ok: true,
      investorId: payload.leadId,
      recognized: !payload.created,
      ...(session ? { session } : {}),
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
