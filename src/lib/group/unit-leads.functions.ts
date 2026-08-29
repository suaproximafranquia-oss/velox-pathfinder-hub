/**
 * Interessados nas unidades Velox Solar e Velox Seguros.
 *
 * O Portal Institucional NÃO abre jornada operacional para essas
 * unidades: ele apenas registra o interesse, que vira card no
 * workspace. Nenhum disparo automático acontece aqui.
 */
import { createServerFn } from "@tanstack/react-start";

const RANGES = ["10_20", "20_30", "acima_30"] as const;
const UNITS = ["solar", "seguros"] as const;

export type UnitLeadInput = {
  unit: (typeof UNITS)[number];
  name: string;
  whatsapp: string;
  email: string | null;
  city: string | null;
  investmentRange: (typeof RANGES)[number];
  origin: string | null;
  campaign: string | null;
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
      origin: data.origin ?? "Portal Institucional do Grupo Velox",
      campaign: data.campaign ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
