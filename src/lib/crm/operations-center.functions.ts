/**
 * CENTRAL DE OPERAÇÕES — ponte cliente ↔ servidor.
 *
 * Somente leitura e somente administração/gestão. Toda a consolidação
 * vive no servidor (uma única chamada por período), para não disparar
 * uma consulta por card.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AUTORIZAÇÃO ÚNICA — mesma decisão central do Corporate Workspace. */
async function assertAdmin(context: any) {
  const { assertWorkspaceAccess } = await import("@/server/workspace-authorization.server");
  await assertWorkspaceAccess(context as never, "central_operacoes");
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
