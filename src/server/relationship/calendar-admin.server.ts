/**
 * CALENDÁRIO ADMINISTRÁVEL DE DIAS SEM ENVIO — SERVER ONLY.
 *
 * A lista oficial (feriados nacionais + estaduais SP) continua sendo
 * calculada em `holidays.ts` e NÃO é editável. Esta camada apenas SOMA
 * datas extras registradas pela gestão (pontos facultativos, recesso),
 * com efeito imediato no próximo cálculo — sem migração e sem deploy.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NonBusinessDay = { day: string; reason: string };

export async function listExtraNonBusinessDays(): Promise<NonBusinessDay[]> {
  const { data } = await supabaseAdmin
    .from("relationship_non_business_days" as never)
    .select("day,reason")
    .order("day", { ascending: true });
  return ((data ?? []) as unknown as NonBusinessDay[]).map((row) => ({
    day: String(row.day),
    reason: row.reason ?? "",
  }));
}

export async function addExtraNonBusinessDay(
  day: string,
  reason: string,
  userId: string | null,
): Promise<NonBusinessDay[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Data inválida. Use o formato AAAA-MM-DD.");
  }
  // A unicidade é garantida pelo banco: repetir a data não duplica.
  await supabaseAdmin
    .from("relationship_non_business_days" as never)
    .upsert({ day, reason: reason.trim(), created_by: userId } as never, {
      onConflict: "day",
    } as never);
  return listExtraNonBusinessDays();
}

export async function removeExtraNonBusinessDay(day: string): Promise<NonBusinessDay[]> {
  await supabaseAdmin
    .from("relationship_non_business_days" as never)
    .delete()
    .eq("day", day);
  return listExtraNonBusinessDays();
}

/**
 * Sincroniza a configuração do motor com as datas administradas. É
 * chamada no início de cada tique do agendador: o cálculo de prazos
 * passa a considerar as datas extras já na execução seguinte.
 */
export async function syncNonBusinessCalendar(): Promise<string[]> {
  const { setExtraNonBusinessDays } = await import("@/lib/relationship/config");
  try {
    const rows = await listExtraNonBusinessDays();
    return setExtraNonBusinessDays(rows.map((r) => r.day));
  } catch {
    // Falha de leitura não pode derrubar o motor: vale o calendário oficial.
    return setExtraNonBusinessDays([]);
  }
}
