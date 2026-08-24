/**
 * Carga histórica final — ponto de entrada autenticado.
 *
 * Somente Administradores e Gestores podem executar. A rotina é
 * idempotente e não destrutiva por construção (ver
 * src/server/crm/historical-import.server.ts): nunca duplica, nunca
 * substitui e jamais exclui Leads.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { HistoricalLeadInput } from "@/server/crm/historical-import.server";

export const runHistoricalImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rows: HistoricalLeadInput[] }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isManager } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "manager",
    });
    if (!isAdmin && !isManager) throw new Error("Forbidden");
    if (!Array.isArray(data.rows) || data.rows.length === 0) {
      throw new Error("Nenhum registro informado para a carga histórica.");
    }
    const { importHistoricalLeads } = await import("@/server/crm/historical-import.server");
    return importHistoricalLeads(data.rows);
  });
