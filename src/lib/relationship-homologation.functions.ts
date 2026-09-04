/**
 * Acesso da interface à HOMOLOGAÇÃO do motor de relacionamento.
 * Restrito à gestão autenticada. Nenhuma destas funções toca produção,
 * Portal dos Leads ou GreenSales, e nenhuma envia mensagem real.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertManager(context: { supabase: never; userId: string }) {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>;
  };
  const [admin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!admin.data && !manager.data) throw new Error("Acesso restrito à gestão.");
}

export const runRelationshipHomologation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        executiveName: z.string().min(2).default("Thiago Rodrigues"),
        portalLink: z.string().min(4).default("https://portal.velox.com.br/f/thiago-rodrigues"),
        totalLeads: z.number().int().min(10).max(300).default(300),
        userName: z.string().min(1).default("Gestão"),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { executeHomologationRun } = await import("@/server/relationship/homologation.server");
    return executeHomologationRun({ ...data, userId: context.userId });
  });

export const listRelationshipRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context as never);
    const { listHomologationRuns } = await import("@/server/relationship/homologation.server");
    return listHomologationRuns();
  });

export const readRelationshipRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ runId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { readHomologationRun } = await import("@/server/relationship/homologation.server");
    return readHomologationRun(data.runId);
  });

/**
 * RESET CONTROLADO DO WORKSPACE DE HOMOLOGAÇÃO (COMANDO 3D §2, §29, §30).
 * `dryRun` produz apenas o relatório de escopo; nada é apagado.
 */
export const resetHomologationWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ dryRun: z.boolean().default(true) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { executeWorkspaceReset } = await import(
      "@/server/relationship/workspace-reset.server"
    );
    return executeWorkspaceReset(supabaseAdmin as never, { dryRun: data.dryRun });
  });
