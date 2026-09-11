import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalLeadPayload = {
  unit?: "f" | "s" | "seg";
  id: string;
  name: string;
  email: string;
  whatsapp?: string;
  city?: string;
  origin?: string;
  material?: string;
  scope: "green_sales" | "redistribuicao" | "portal" | "tiktok" | "meta";
  personalized?: boolean;
  responsibleExecutiveId?: string | null;
  responsibleExecutiveSlug?: string | null;
  campaign?: string | null;
  device?: string | null;
  createdAt?: string;
  lastActivityAt?: string;
  journey?: Record<string, unknown>;
};

/**
 * Persistência REAL do Lead (Prompt 2/3/4).
 *
 * O Gateway roda no navegador do investidor; o Workspace, no navegador do
 * executivo. Sem esta gravação no servidor o Card nunca chegaria ao
 * Workspace. Função pública de propósito: o visitante não é autenticado.
 * O escopo é decidido no cliente por `resolveLeadScope` e revalidado aqui.
 */
export const syncPortalLead = createServerFn({ method: "POST" })
  .inputValidator((data: PortalLeadPayload) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const financial = data.unit === "f";
    const executiveId = data.responsibleExecutiveId ?? null;
    const email = data.email.trim().toLowerCase();
    const digits = (data.whatsapp ?? "").replace(/\D+/g, "");
    const phoneKey = digits.length > 11 ? digits.slice(-11) : digits;

    /**
     * BLOCO 2 §6 — CORREÇÃO MANUAL TEM PRECEDÊNCIA.
     *
     * Campos travados pelo executivo (`manual_overrides`) nunca são
     * sobrescritos por uma sincronização do Portal. O valor informado
     * pelo investidor é preservado como dado alternativo e auditado.
     */
    const applyIdentityGuard = async (
      leadId: string,
    ): Promise<Partial<Record<"name" | "email" | "whatsapp" | "city", string>>> => {
      const { data: row } = await supabaseAdmin
        .from("portal_leads")
        .select("name,email,whatsapp,city,manual_overrides,identity_alternates")
        .eq("id", leadId)
        .maybeSingle();
      if (!row) return { email, whatsapp: data.whatsapp ?? "", city: data.city ?? "" };
      const overrides = (row.manual_overrides ?? {}) as Record<string, { locked?: boolean }>;
      const incoming: Record<string, string> = {
        name: data.name,
        email,
        whatsapp: data.whatsapp ?? "",
        city: data.city ?? "",
      };
      const current: Record<string, string> = {
        name: row.name ?? "",
        email: row.email ?? "",
        whatsapp: row.whatsapp ?? "",
        city: row.city ?? "",
      };
      const alternates = (row.identity_alternates ?? {}) as Record<string, unknown[]>;
      const at = new Date().toISOString();
      let changedAlternates = false;
      const patch: Partial<Record<"name" | "email" | "whatsapp" | "city", string>> = {};
      for (const field of ["name", "email", "whatsapp", "city"] as const) {
        // Cadastro principal soberano: omitir a coluna também protege uma
        // edição do executivo que ocorra entre esta leitura e a gravação.
        if (!financial && field === "name") continue;
        const locked = Boolean(overrides[field]?.locked);
        const official = financial && field !== "city" && Boolean(current[field]);
        if (!locked && !official) {
          patch[field] = incoming[field];
          continue;
        }
        if (!financial) patch[field] = current[field];
        if (incoming[field] && incoming[field] !== current[field]) {
          const bucket = Array.isArray(alternates[field]) ? alternates[field] : [];
          if (financial && bucket.some((item) => (item as { value?: unknown })?.value === incoming[field])) continue;
          alternates[field] = [
            ...bucket,
            { value: incoming[field], at, source: "portal", blockedBy: locked ? "manual_override" : "official_identity" },
          ];
          changedAlternates = true;
        }
      }
      if (changedAlternates) {
        await supabaseAdmin
          .from("portal_leads")
          .update({ identity_alternates: alternates as never })
          .eq("id", leadId);
        await supabaseAdmin.from("portal_journey_events").insert({
          investor_id: leadId,
          event: "identity.divergence.blocked",
          module: "portal",
          detail:
            "Valor informado pelo investidor divergiu da identidade oficial — preservado como dado alternativo.",
        } as never);
      }
      return patch;
    };


    /**
     * DEDUPE OFICIAL — a MESMA pessoa nunca vira dois leads.
     *
     * Um investidor que já existe (ex.: carteira do Thiago) e volta pelo
     * link personalizado de outro executivo (ex.: Larissa) NÃO gera novo
     * registro: reaproveitamos o lead existente, preservamos o
     * proprietário atual e gravamos a nova entrada como EVENTO,
     * atribuído ao executivo do link.
     */
    const { data: byIdentity } = await supabaseAdmin
      .from("portal_leads")
      .select("id,scope,responsible_executive_id,responsible_executive_slug,whatsapp")
      .eq("email", email)
      .limit(10);
    const duplicate = (byIdentity ?? []).find((row) => {
      if (row.id === data.id) return false;
      if (!phoneKey) return true; // mesmo e-mail já basta quando não há telefone
      const d = (row.whatsapp ?? "").replace(/\D+/g, "");
      const key = d.length > 11 ? d.slice(-11) : d;
      return !key || key === phoneKey;
    });

    const targetId = duplicate?.id ?? data.id;
    const { data: current } = await supabaseAdmin
      .from("portal_leads")
      .select("scope,responsible_executive_id,responsible_executive_slug,last_activity_at")
      .eq("id", targetId)
      .maybeSingle();


    const providedActivity = data.lastActivityAt && Number.isFinite(Date.parse(data.lastActivityAt))
      && (!current?.last_activity_at || Date.parse(data.lastActivityAt) > Date.parse(current.last_activity_at))
      ? data.lastActivityAt : null;

    const registerEntry = async (reason: string) => {
      await supabaseAdmin.from("portal_journey_events").insert({
        investor_id: targetId,
        event: "journey.entry.registered",
        module: "portal",
        detail: reason,
      } as never);
    };

    if (duplicate) {
      // Ownership respeitado: quem já responde pelo lead continua
      // respondendo. Apenas atualizamos os dados e registramos a entrada.
      const guarded = await applyIdentityGuard(targetId);
      const { error: dedupeError } = await supabaseAdmin
        .from("portal_leads")
        .update({
          ...guarded,
          ...(data.journey && Object.keys(data.journey).length ? { journey: data.journey as never } : {}),
          // Atividade só avança com atividade REAL informada pelo navegador
          // do investidor; nunca `now()` por sincronização.
          ...(providedActivity ? { last_activity_at: providedActivity } : {}),
        })
        .eq("id", targetId);
      if (dedupeError) throw new Error(dedupeError.message);
      if (!financial || data.personalized) await registerEntry(
        data.personalized && data.responsibleExecutiveSlug
          ? `Nova entrada pelo link personalizado de ${data.responsibleExecutiveSlug} — lead já existente, sem duplicação.`
          : "Nova entrada pelo Portal institucional — lead já existente, sem duplicação.",
      );
      return {
        ok: true as const,
        scope: (current?.scope ?? "portal") as
          | "green_sales"
          | "redistribuicao"
          | "portal"
          | "tiktok"
          | "meta",
        leadId: targetId,
        deduped: true as const,
      };
    }

    // Cadastro existente: identidade, vínculo, origem e histórico são soberanos.
    if (current && (financial || current.scope === "redistribuicao")) {
      const guarded = await applyIdentityGuard(targetId);
      const { error: keepError } = await supabaseAdmin
        .from("portal_leads")
        .update({
          ...guarded,
          ...(data.journey && Object.keys(data.journey).length ? { journey: data.journey as never } : {}),
          ...(providedActivity ? { last_activity_at: providedActivity } : {}),
        })
        .eq("id", targetId);
      if (keepError) throw new Error(keepError.message);
      return {
        ok: true as const,
        scope: current.scope,
        leadId: targetId,
        deduped: false as const,
      };
    }
    // Revalidação do roteamento obrigatório: green_sales exige executivo.
    // COMANDO 3 §8 — escopo de canal (TikTok/Meta) é preservado tal como
    // decidido pela fonte central de propriedade (ownership).
    const scope =
      data.personalized && executiveId
        ? ("green_sales" as const)
        : data.scope === "tiktok" || data.scope === "meta"
          ? data.scope
          : ("portal" as const);
    const { isManagementExecutive } = await import("@/server/crm/manager-guard.server");
    const candidateOwner = current?.responsible_executive_id ?? (scope === "green_sales" ? executiveId : null);
    const preservedOwner = current?.responsible_executive_id ?? ((await isManagementExecutive(candidateOwner)) ? null : candidateOwner);
    const nowIso = new Date().toISOString();
    const guardedIdentity = current ? await applyIdentityGuard(targetId) : { email, whatsapp: data.whatsapp ?? "", city: data.city ?? "" };
    const payload = {
        id: targetId,
        ...guardedIdentity,
        origin: data.origin ?? "Portal Velox",
        material: data.material ?? "",
        scope,
        personalized: Boolean(data.personalized && executiveId),
        responsible_executive_id: preservedOwner,
        responsible_executive_slug:
          scope === "green_sales"
            ? (current?.responsible_executive_slug ?? data.responsibleExecutiveSlug ?? null)
            : null,
        campaign: data.campaign ?? null,
        device: data.device ?? null,
        created_at: data.createdAt ?? nowIso,
        // A coluna é NOT NULL: o fallback só cobre registros legados.
        last_activity_at: providedActivity ?? current?.last_activity_at ?? data.createdAt ?? nowIso,
        journey: (data.journey ?? {}) as never,
      };
    let created = false;
    let error;
    // Inserção concorrente não autoriza substituir identidade nem contexto.
    if (current) {
      ({ error } = await supabaseAdmin.from("portal_leads").update(payload).eq("id", targetId));
    } else {
      ({ error } = await supabaseAdmin.from("portal_leads").insert({ ...payload, name: data.name, email }));
      created = !error;
    }
    if (error?.code === "23505") {
      const guarded = financial ? await applyIdentityGuard(targetId) : payload;
      ({ error } = await supabaseAdmin.from("portal_leads").update(guarded).eq("id", targetId));
    }
    if (error) throw new Error(error.message);
    /**
     * COMANDO 3A §4 — PRIMEIRO CONTATO TAMBÉM NASCE NO PORTAL.
     *
     * Um lead NOVO criado por qualquer link operacional do Portal (Home,
     * link personalizado, TikTok ou Meta) entra na MESMA regra oficial
     * de primeiro contato: elegibilidade pela data de ativação, trava de
     * madrugada com retomada às 07:00, idempotência por `msg_e0_` e
     * abertura E0_V1 no motor de relacionamento. Em homologação a E0 é
     * SIMULADA — nenhuma chamada real à Meta. Falha aqui nunca quebra a
     * jornada do investidor.
     */
    if (created) {
      try {
        const { kickoffPortalFirstContact } = await import(
          "@/server/crm/portal-first-contact.server"
        );
        await kickoffPortalFirstContact({
          leadId: targetId,
          name: data.name,
          phone: data.whatsapp ?? "",
          scope,
          ownerId: preservedOwner,
          entryAt: data.createdAt ?? nowIso,
        });
      } catch (kickoffError) {
        console.error(
          "[portal-leads] primeiro contato do lead do Portal não pode ser avaliado:",
          kickoffError instanceof Error ? kickoffError.message : kickoffError,
        );
      }
    }
    return { ok: true as const, scope, leadId: targetId, deduped: false as const };
  });


/**
 * ETAPA 02.1 §Doc02 ITEM 03 — redistribuição oficial executada pela
 * Gestão. Não cria Lead, não altera histórico: apenas transfere a
 * responsabilidade operacional e fixa a origem "Redistribuição".
 */
export const redistributePortalLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; executiveId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAssignableExecutive } = await import("@/server/crm/manager-guard.server");
    await assertAssignableExecutive(data.executiveId);
    const { error } = await context.supabase
      .from("portal_leads")
      .update({
        scope: "redistribuicao",
        personalized: false,
        responsible_executive_id: data.executiveId,
        responsible_executive_slug: null,
        // Ação ADMINISTRATIVA: nunca grava atividade do investidor.
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Leitura da carteira — somente equipe autenticada.
 */
/**
 * Transferência oficial de proprietário (Gestora/Administrador).
 *
 * Diferente da redistribuição, aqui a carteira de origem é preservada:
 * apenas o Executivo responsável muda — e muda de verdade, na base.
 */
export const assignPortalLeadOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; executiveId: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertAssignableExecutive } = await import("@/server/crm/manager-guard.server");
    await assertAssignableExecutive(data.executiveId);
    const { error } = await context.supabase
      .from("portal_leads")
      .update({
        responsible_executive_id: data.executiveId,
        // Ação ADMINISTRATIVA: nunca grava atividade do investidor.
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Usa POST de propósito: leituras GET podem ser servidas do cache do
 * navegador e congelariam o Workspace em um estado antigo.
 */
export const listPortalLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("portal_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * BLINDAGEM DEFINITIVA — não existe operação normal de exclusão de Lead.
 *
 * Qualquer solicitação de remoção de um Lead real é registrada em
 * auditoria (usuário, data/hora, operação, motivo) e bloqueada com a
 * mensagem oficial. O gatilho `guard_lead_delete` no banco é a última
 * linha de defesa e vale para qualquer rotina, inclusive serviços.
 *
 * Única exceção: registros marcadamente de teste (homologação).
 */
export const deletePortalLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isTestLeadRecord, LEAD_GUARD_MESSAGE } = await import("@/lib/lead-guard");
    const { data: lead } = await supabaseAdmin
      .from("portal_leads")
      .select("id,name,is_test")
      .eq("id", data.id)
      .maybeSingle();

    // Limpeza de homologação: somente registros marcadamente de teste.
    if (lead && isTestLeadRecord(lead as { id: string; is_test?: boolean | null })) {
      const { error } = await supabaseAdmin.from("portal_leads").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }

    const { logBlockedLeadOperation } = await import("@/server/lead-guard.server");
    await logBlockedLeadOperation({
      tableName: "portal_leads",
      leadId: data.id,
      leadName: (lead as { name?: string } | null)?.name ?? null,
      operation: "delete",
      actorUserId: context.userId,
      actorLabel: (context.claims as { email?: string } | null)?.email ?? null,
      reason: "Solicitação de exclusão de Lead bloqueada pela blindagem definitiva.",
    });
    throw new Error(LEAD_GUARD_MESSAGE);
  });

/**
 * Recuperação da Jornada Digital em outro navegador ou dispositivo.
 *
 * O visitante não é autenticado, por isso a consulta exige e-mail E
 * WhatsApp coincidentes com o mesmo registro — nunca devolve lista, nunca
 * permite varredura da base e devolve apenas o mínimo necessário para
 * restaurar a jornada.
 */
export const lookupPortalLead = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; phone: string }) => data)
  .handler(async ({ data }) => {
    const email = (data.email ?? "").trim().toLowerCase();
    const phoneDigits = (data.phone ?? "").replace(/\D+/g, "");
    const phoneKey = phoneDigits.length > 11 ? phoneDigits.slice(-11) : phoneDigits;
    if (!email || phoneKey.length < 10) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("portal_leads")
      .select(
        "id,name,email,whatsapp,city,origin,material,scope,personalized,responsible_executive_id,created_at",
      )
      .eq("email", email)
      .limit(5);
    if (error) throw new Error(error.message);

    const match = (rows ?? []).find((row) => {
      const digitsRow = (row.whatsapp ?? "").replace(/\D+/g, "");
      const keyRow = digitsRow.length > 11 ? digitsRow.slice(-11) : digitsRow;
      return keyRow === phoneKey;
    });
    return match ?? null;
  });
