/**
 * Interessados nas marcas do Grupo (Financeira, Solar e Seguros)
 * captados pelas páginas institucionais.
 *
 * O Portal Institucional NÃO abre jornada operacional para essas
 * unidades: ele apenas registra o interesse, que vira card na carteira
 * própria da unidade dentro do Workspace. Nenhum disparo automático
 * acontece aqui e nada entra em `portal_leads`, CRM ou cadência.
 *
 * IDENTIDADE: o mesmo WhatsApp na mesma unidade é SEMPRE a mesma
 * pessoa. Um novo envio atualiza o registro existente e vira evento no
 * histórico — nunca um segundo card. Unidades diferentes são carteiras
 * diferentes: o mesmo contato pode existir em Solar e em Seguros.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RANGES = ["10_20", "20_30", "acima_30"] as const;
const UNITS = ["financeira", "solar", "seguros"] as const;
const CONTACT_STATUS = ["pendente", "em_contato", "encerrado"] as const;

export type UnitLeadInput = {
  unit: (typeof UNITS)[number];
  name: string;
  whatsapp: string;
  email: string | null;
  city: string | null;
  investmentRange: (typeof RANGES)[number];
  origin: string | null;
  campaign: string | null;
  /** Chegou pelo Portal Institucional do Grupo Velox. */
  fromGroup?: boolean;
};

function phoneKey(value: string): string {
  return value.replace(/\D/g, "");
}

function emailKey(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || null;
}

export const registrarInteresseUnidade = createServerFn({ method: "POST" })
  .inputValidator((input: UnitLeadInput) => {
    if (!UNITS.includes(input?.unit)) throw new Error("Unidade inválida.");
    if (!input?.name?.trim()) throw new Error("Informe seu nome.");
    const digits = phoneKey(input?.whatsapp ?? "");
    if (digits.length < 10) throw new Error("Informe um WhatsApp válido com DDD.");
    /** Campos obrigatórios da carteira das unidades (Solar/Seguros). */
    const email = (input?.email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    if ((input?.city ?? "").trim().length < 2) throw new Error("Informe sua cidade.");
    if (!RANGES.includes(input?.investmentRange)) throw new Error("Selecione a faixa de investimento.");
    return { ...input, whatsapp: digits, email, city: (input?.city ?? "").trim() };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const key = phoneKey(data.whatsapp);

    const { data: existing } = await supabaseAdmin
      .from("group_unit_leads")
      .select("id, submissions, first_contact_status")
      .eq("unit", data.unit)
      .eq("whatsapp_key", key)
      .maybeSingle();

    const payload = {
      unit: data.unit,
      name: data.name.trim(),
      whatsapp: data.whatsapp,
      whatsapp_key: key,
      email: data.email?.trim() || null,
      email_key: emailKey(data.email),
      city: data.city?.trim() || null,
      investment_range: data.investmentRange,
      origin: data.origin?.trim() || "Portal Institucional do Grupo Velox",
      campaign: data.campaign ?? null,
      from_group: Boolean(data.fromGroup),
      last_submitted_at: now,
      updated_at: now,
    };

    if (existing) {
      const id = String((existing as any).id);
      const { error } = await supabaseAdmin
        .from("group_unit_leads")
        .update({ ...payload, submissions: Number((existing as any).submissions ?? 1) + 1 } as never)
        .eq("id", id);
      if (error) throw new Error(error.message);

      // Novo envio do MESMO contato: fato registrado no histórico, sem
      // reabrir situação nem criar um segundo card.
      await supabaseAdmin.from("group_unit_lead_events").insert({
        lead_id: id,
        unit: data.unit,
        kind: "novo_envio",
        note: "Formulário preenchido novamente pelo mesmo contato.",
        actor_name: "Formulário público",
        metadata: { faixa: data.investmentRange, cidade: data.city ?? null } as never,
      } as never);
      return { ok: true as const, duplicated: true as const };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("group_unit_leads")
      .insert({ ...payload, first_contact_status: "pendente", submissions: 1 } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("group_unit_lead_events").insert({
      lead_id: String((inserted as any).id),
      unit: data.unit,
      kind: "registrado",
      note: "Interesse registrado pelo formulário da unidade.",
      actor_name: "Formulário público",
      metadata: { faixa: data.investmentRange, veio_do_grupo: Boolean(data.fromGroup) } as never,
    } as never);

    return { ok: true as const, duplicated: false as const };
  });

const SELECT_COLUMNS =
  "id, unit, name, whatsapp, email, city, investment_range, origin, campaign, from_group, first_contact_status, first_contact_at, first_contact_by_name, contact_note, close_reason, responsible_executive_id, responsible_executive_name, assigned_by_name, assigned_at, submissions, last_submitted_at, created_at";

/** Carteira da unidade dentro do Workspace — leitura administrativa. */
export const listarInteressadosUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { unit: (typeof UNITS)[number] }) => {
    if (!UNITS.includes(input?.unit)) throw new Error("Unidade inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertUnitPortfolioAccess } = await import("@/server/authorization.server");
    await assertUnitPortfolioAccess(context as never);
    const { data: rows, error } = await context.supabase
      .from("group_unit_leads")
      .select(SELECT_COLUMNS)
      .eq("unit", data.unit)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Histórico completo de um interessado — quem fez o quê e quando. */
export const historicoInteressadoUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Interessado inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertUnitPortfolioAccess } = await import("@/server/authorization.server");
    await assertUnitPortfolioAccess(context as never);
    const { data: rows, error } = await context.supabase
      .from("group_unit_lead_events")
      .select("id, kind, from_status, to_status, note, reason, actor_name, at")
      .eq("lead_id", data.id)
      .order("at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Situação do primeiro contato — feita por pessoa, nunca automática.
 * Encerrar exige motivo; toda mudança guarda autor, data/hora e o
 * estado anterior.
 */
export const atualizarContatoUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      status: (typeof CONTACT_STATUS)[number];
      note?: string | null;
      reason?: string | null;
    }) => {
      if (!input?.id) throw new Error("Interessado inválido.");
      if (!CONTACT_STATUS.includes(input?.status)) throw new Error("Situação inválida.");
      if (input.status === "encerrado" && !input.reason?.trim()) {
        throw new Error("Informe o motivo do encerramento.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { assertUnitPortfolioAccess } = await import("@/server/authorization.server");
    await assertUnitPortfolioAccess(context as never);

    const actorName = String(
      (context.claims as Record<string, any> | null)?.["email"] ?? "Administrador",
    );
    const now = new Date().toISOString();

    const { data: before } = await context.supabase
      .from("group_unit_leads")
      .select("unit, first_contact_status, first_contact_at, first_contact_by")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("Interessado não encontrado.");

    const previous = String((before as any).first_contact_status ?? "pendente");
    const isFirstContact = !(before as any).first_contact_by && data.status !== "pendente";

    const { error } = await context.supabase
      .from("group_unit_leads")
      .update({
        first_contact_status: data.status,
        first_contact_at:
          data.status === "pendente" ? null : ((before as any).first_contact_at ?? now),
        ...(isFirstContact
          ? { first_contact_by: context.userId, first_contact_by_name: actorName }
          : {}),
        ...(data.note !== undefined ? { contact_note: data.note?.trim() || null } : {}),
        close_reason: data.status === "encerrado" ? (data.reason?.trim() ?? null) : null,
        updated_at: now,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("group_unit_lead_events").insert({
      lead_id: data.id,
      unit: String((before as any).unit),
      kind: "situacao",
      from_status: previous,
      to_status: data.status,
      note: data.note?.trim() || null,
      reason: data.status === "encerrado" ? (data.reason?.trim() ?? null) : null,
      actor_id: context.userId,
      actor_name: actorName,
    } as never);

    return { ok: true as const };
  });

/** Responsável pelo interessado — atribuição e troca ficam registradas. */
export const atribuirResponsavelUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; executiveId: string | null; executiveName: string | null }) => {
      if (!input?.id) throw new Error("Interessado inválido.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { assertUnitPortfolioAccess } = await import("@/server/authorization.server");
    await assertUnitPortfolioAccess(context as never);

    const actorName = String(
      (context.claims as Record<string, any> | null)?.["email"] ?? "Administrador",
    );
    const now = new Date().toISOString();

    const { data: before } = await context.supabase
      .from("group_unit_leads")
      .select("unit, responsible_executive_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("Interessado não encontrado.");

    const { error } = await context.supabase
      .from("group_unit_leads")
      .update({
        responsible_executive_id: data.executiveId,
        responsible_executive_name: data.executiveName,
        assigned_by: context.userId,
        assigned_by_name: actorName,
        assigned_at: now,
        updated_at: now,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("group_unit_lead_events").insert({
      lead_id: data.id,
      unit: String((before as any).unit),
      kind: "responsavel",
      note: data.executiveName
        ? `Responsável definido: ${data.executiveName}`
        : "Responsável removido",
      actor_id: context.userId,
      actor_name: actorName,
      metadata: {
        anterior: (before as any).responsible_executive_name ?? null,
        atual: data.executiveName,
      } as never,
    } as never);

    return { ok: true as const };
  });
