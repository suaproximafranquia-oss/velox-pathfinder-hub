/**
 * Interessados nas unidades Velox Solar e Velox Seguros.
 *
 * O Portal Institucional NÃO abre jornada operacional para essas
 * unidades: ele apenas registra o interesse, que vira card na carteira
 * própria da unidade dentro do Workspace. Nenhum disparo automático
 * acontece aqui e nada entra em `portal_leads`, CRM ou cadência.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RANGES = ["10_20", "20_30", "acima_30"] as const;
const UNITS = ["solar", "seguros"] as const;
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

export const registrarInteresseUnidade = createServerFn({ method: "POST" })
  .inputValidator((input: UnitLeadInput) => {
    if (!UNITS.includes(input?.unit)) throw new Error("Unidade inválida.");
    if (!input?.name?.trim()) throw new Error("Informe seu nome.");
    const digits = (input?.whatsapp ?? "").replace(/\D/g, "");
    if (digits.length < 10) throw new Error("Informe um WhatsApp válido com DDD.");
    if (!RANGES.includes(input?.investmentRange)) throw new Error("Selecione a faixa de investimento.");
    return { ...input, whatsapp: digits };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("group_unit_leads").insert({
      unit: data.unit,
      name: data.name.trim(),
      whatsapp: data.whatsapp,
      email: data.email?.trim() || null,
      city: data.city?.trim() || null,
      investment_range: data.investmentRange,
      origin: data.origin?.trim() || "Portal Institucional do Grupo Velox",
      campaign: data.campaign ?? null,
      from_group: Boolean(data.fromGroup),
      first_contact_status: "pendente",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

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
      .select(
        "id, unit, name, whatsapp, email, city, investment_range, origin, campaign, from_group, first_contact_status, first_contact_at, created_at",
      )
      .eq("unit", data.unit)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Situação do primeiro contato — feito por pessoa, nunca automático. */
export const atualizarContatoUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: (typeof CONTACT_STATUS)[number] }) => {
    if (!input?.id) throw new Error("Interessado inválido.");
    if (!CONTACT_STATUS.includes(input?.status)) throw new Error("Situação inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertUnitPortfolioAccess } = await import("@/server/authorization.server");
    await assertUnitPortfolioAccess(context as never);
    const { error } = await context.supabase
      .from("group_unit_leads")
      .update({
        first_contact_status: data.status,
        first_contact_at: data.status === "pendente" ? null : new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
