/**
 * LEITURA E GRAVAÇÃO DOS LANÇAMENTOS DO KPI — SERVIDOR É A FONTE.
 *
 * A tela continua idêntica: mesmos indicadores, cálculos, metas,
 * consolidado e seleção individual. Só a ORIGEM dos números mudou —
 * agora vem de `kpi_entries`, com o mesmo escopo já usado pela tela.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KpiCellDTO = { indicatorId: string; day: number; value: number };
export type KpiMonthDTO = { cells: KpiCellDTO[]; updatedAt: number };

/** Ranking corporativo: equipe oficial, com projeção limitada aos dois indicadores públicos da campanha. */
export const lerVendasCampanhas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveKpiScope } = await import("@/server/kpi/kpi-scope.server");
    const scope = await resolveKpiScope(context.userId, context.supabase as never);
    const { listActiveOperationalExecutives } = await import("@/server/operational-team.server");
    const team = await listActiveOperationalExecutives();
    const { readCampaignSales } = await import("@/server/kpi/kpi-store.server");
    const datasets = await readCampaignSales(team.map((entry) => entry.id), data.monthKey);
    return { team: team.map(({ id, name }) => ({ id, name })), datasets,
      readableReportIds: scope.collaborators.map((entry) => entry.id) };
  });

/** Brain usa o mesmo recorte do KPI, inclusive nas competências de comparação. */
export const lerKpiBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    monthKeys: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1).max(12),
    executiveId: z.string().min(1).nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveKpiScope, readableExecutiveIds } = await import("@/server/kpi/kpi-scope.server");
    const scope = await resolveKpiScope(context.userId, context.supabase as never);
    const ids = readableExecutiveIds(scope, data.executiveId);
    if (data.executiveId && !ids.length) throw new Error("Executivo fora do seu escopo autorizado.");
    const { readKpiMonthForMany } = await import("@/server/kpi/kpi-store.server");
    const months = await Promise.all([...new Set(data.monthKeys)].map(async (key) =>
      [key, await readKpiMonthForMany(ids, key)] as const));
    return { scope, months: Object.fromEntries(months) };
  });

const monthSchema = z.object({
  monthKey: z.string().min(4),
  /** `null` = consolidado do recorte autorizado. */
  executiveId: z.string().min(1).nullable(),
});

const cellSchema = z.object({
  monthKey: z.string().min(4),
  executiveId: z.string().min(1),
  indicatorId: z.string().min(1),
  day: z.number().int().min(1).max(31),
  value: z.number().finite(),
});

const resetSchema = z.object({
  monthKey: z.string().min(4),
  executiveId: z.string().min(1),
});

/** Lançamentos de uma competência (individual ou consolidado). */
export const lerKpiMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => monthSchema.parse(input))
  .handler(async ({ data, context }): Promise<KpiMonthDTO> => {
    const { resolveKpiScope, readableExecutiveIds } = await import(
      "@/server/kpi/kpi-scope.server"
    );
    const scope = await resolveKpiScope(context.userId, context.supabase as never);
    const ids = readableExecutiveIds(scope, data.executiveId);
    if (ids.length === 0) return { cells: [], updatedAt: Date.now() };

    const { readKpiMonth, readKpiMonthForMany } = await import(
      "@/server/kpi/kpi-store.server"
    );
    return ids.length === 1 && data.executiveId
      ? readKpiMonth(ids[0]!, data.monthKey)
      : readKpiMonthForMany(ids, data.monthKey);
  });

/** Grava uma célula. Duplicidade é impedida pela chave única da tabela. */
export const salvarKpiCelula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cellSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { resolveKpiScope, canWriteExecutive } = await import(
      "@/server/kpi/kpi-scope.server"
    );
    const scope = await resolveKpiScope(context.userId, context.supabase as never);
    if (!canWriteExecutive(scope, data.executiveId)) {
      throw new Error("Lançamento fora do seu escopo autorizado.");
    }
    const { writeKpiCell } = await import("@/server/kpi/kpi-store.server");
    await writeKpiCell({
      executiveId: data.executiveId,
      monthKey: data.monthKey,
      indicatorId: data.indicatorId,
      day: data.day,
      value: data.value,
      updatedBy: context.userId,
    });
    return { ok: true };
  });

/** Limpa SOMENTE a competência informada, do executivo autorizado. */
export const limparKpiMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { resolveKpiScope, canWriteExecutive } = await import(
      "@/server/kpi/kpi-scope.server"
    );
    const scope = await resolveKpiScope(context.userId, context.supabase as never);
    if (!canWriteExecutive(scope, data.executiveId)) {
      throw new Error("Limpeza fora do seu escopo autorizado.");
    }
    const { clearKpiMonth } = await import("@/server/kpi/kpi-store.server");
    await clearKpiMonth(data.executiveId, data.monthKey);
    return { ok: true };
  });
