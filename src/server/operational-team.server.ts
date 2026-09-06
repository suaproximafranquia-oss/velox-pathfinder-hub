/**
 * EQUIPE OPERACIONAL ATIVA — FONTE ÚNICA NO SERVIDOR.
 *
 * Antes a equipe vinha de uma lista fixa no código (`OPERATIONAL_EXECUTIVE_IDS`),
 * o que impedia que um executivo novo aparecesse automaticamente e mantinha
 * a Gestora dentro do recorte de executivos.
 *
 * Regra definitiva:
 *   • entra quem tem ficha de executivo ATIVA;
 *   • sai quem está inativo/excluído;
 *   • sai quem é GESTORA (papel `manager` sem papel `admin`) — gestão não é
 *     linha operacional e nunca aparece como executiva em KPI, Campanhas,
 *     rankings, comparações ou indicadores de executivo.
 *
 * Nenhuma métrica é calculada aqui: esta função responde apenas QUEM é
 * executivo ativo.
 */
export type OperationalExecutive = { id: string; name: string };

type Row = Record<string, unknown>;

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function listActiveOperationalExecutives(): Promise<OperationalExecutive[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: profiles }, { data: statuses }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("executive_profiles").select("executive_id,name,user_id"),
    supabaseAdmin.from("executive_user_status").select("executive_id,status"),
    supabaseAdmin.from("user_roles").select("user_id,role"),
  ]);

  const inactive = new Set<string>();
  for (const row of (statuses ?? []) as Row[]) {
    const id = text(row, "executive_id");
    if (id && text(row, "status") === "inativo") inactive.add(id);
  }

  const managerUsers = new Set<string>();
  const adminUsers = new Set<string>();
  for (const row of (roles ?? []) as Row[]) {
    const userId = text(row, "user_id");
    const role = text(row, "role");
    if (!userId) continue;
    if (role === "manager") managerUsers.add(userId);
    if (role === "admin") adminUsers.add(userId);
  }

  return ((profiles ?? []) as Row[])
    .map((row) => {
      const id = text(row, "executive_id");
      if (!id || inactive.has(id)) return null;
      const userId = text(row, "user_id");
      // Gestora (manager puro) não é executiva comercial.
      if (userId && managerUsers.has(userId) && !adminUsers.has(userId)) return null;
      return { id, name: text(row, "name") ?? id };
    })
    .filter((entry): entry is OperationalExecutive => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
