/**
 * LANÇAMENTOS DO KPI — PERSISTÊNCIA OFICIAL NO SERVIDOR.
 *
 * Antes os números do KPI viviam no `localStorage` do navegador de quem
 * digitava, o que impedia a gestão de ver a operação real dos executivos.
 * Agora a fonte de verdade é a tabela `kpi_entries`; o navegador apenas
 * exibe o que o servidor devolve.
 *
 * Nenhum cálculo, indicador ou meta é tocado aqui: este módulo apenas
 * lê e grava células (executivo × mês × indicador × dia).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type KpiCell = {
  indicatorId: string;
  day: number;
  value: number;
};

/** Todas as células de um executivo em uma competência. */
export async function readKpiMonth(
  executiveId: string,
  monthKey: string,
): Promise<{ cells: KpiCell[]; updatedAt: number }> {
  const { data, error } = await supabaseAdmin
    .from("kpi_entries")
    .select("indicator_id,day,value,updated_at")
    .eq("executive_id", executiveId)
    .eq("month_key", monthKey);
  if (error) throw new Error(error.message);

  let updatedAt = 0;
  const cells: KpiCell[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const indicatorId = String(row["indicator_id"] ?? "");
    const day = Number(row["day"] ?? 0);
    if (!indicatorId || !Number.isFinite(day)) continue;
    cells.push({ indicatorId, day, value: Number(row["value"] ?? 0) });
    const at = Date.parse(String(row["updated_at"] ?? ""));
    if (Number.isFinite(at)) updatedAt = Math.max(updatedAt, at);
  }
  return { cells, updatedAt: updatedAt || Date.now() };
}

/** Leitura consolidada — soma as células de vários executivos. */
export async function readKpiMonthForMany(
  executiveIds: string[],
  monthKey: string,
): Promise<{ cells: KpiCell[]; updatedAt: number }> {
  const ids = [...new Set(executiveIds.filter(Boolean))];
  if (ids.length === 0) return { cells: [], updatedAt: Date.now() };

  const { data, error } = await supabaseAdmin
    .from("kpi_entries")
    .select("indicator_id,day,value,updated_at")
    .in("executive_id", ids)
    .eq("month_key", monthKey);
  if (error) throw new Error(error.message);

  const totals = new Map<string, number>();
  let updatedAt = 0;
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const indicatorId = String(row["indicator_id"] ?? "");
    const day = Number(row["day"] ?? 0);
    if (!indicatorId || !Number.isFinite(day)) continue;
    const key = `${indicatorId}|${day}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(row["value"] ?? 0));
    const at = Date.parse(String(row["updated_at"] ?? ""));
    if (Number.isFinite(at)) updatedAt = Math.max(updatedAt, at);
  }

  const cells: KpiCell[] = [...totals.entries()].map(([key, value]) => {
    const [indicatorId, day] = key.split("|");
    return { indicatorId: indicatorId ?? "", day: Number(day), value };
  });
  return { cells, updatedAt: updatedAt || Date.now() };
}

/**
 * Grava UMA célula. A constraint única (executivo, mês, indicador, dia)
 * garante que o mesmo lançamento nunca duplica: o upsert atualiza.
 */
export async function writeKpiCell(input: {
  executiveId: string;
  monthKey: string;
  indicatorId: string;
  day: number;
  value: number;
  updatedBy: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("kpi_entries").upsert(
    {
      executive_id: input.executiveId,
      month_key: input.monthKey,
      indicator_id: input.indicatorId,
      day: input.day,
      value: input.value,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "executive_id,month_key,indicator_id,day" },
  );
  if (error) throw new Error(error.message);
}

/** Limpa SOMENTE a competência informada de um único executivo. */
export async function clearKpiMonth(
  executiveId: string,
  monthKey: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("kpi_entries")
    .delete()
    .eq("executive_id", executiveId)
    .eq("month_key", monthKey);
  if (error) throw new Error(error.message);
}
