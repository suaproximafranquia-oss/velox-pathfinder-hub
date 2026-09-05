/**
 * CENTRAL DE OPERAÇÕES — ponte cliente ↔ servidor.
 *
 * Somente leitura e somente administração/gestão. Toda a consolidação
 * vive no servidor (uma única chamada por período), para não disparar
 * uma consulta por card.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { readAdministrativeAccess } = await import("@/server/authorization.server");
  const access = await readAdministrativeAccess(context);
  if (!access.admin && !access.manager) {
    throw new Error("Central de Operações restrita à administração/gestão.");
  }
}

export const relatorioOperacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => {
    if (!input?.from || !input?.to) throw new Error("Período obrigatório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const mod = await import("@/server/crm/operations-center.server");
    return mod.buildOperationsReport({ from: data.from, to: data.to });
  });
