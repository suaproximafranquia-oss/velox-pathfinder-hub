/**
 * Acesso da interface à HOMOLOGAÇÃO do motor de relacionamento.
 * Restrito à gestão autenticada. Nenhuma destas funções toca produção,
 * Portal dos Leads ou GreenSales, e nenhuma envia mensagem real.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONTENT_GROUPS } from "@/lib/relationship/content";

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

const contentSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  group: z.enum(CONTENT_GROUPS),
  name: z.string().min(2),
  kind: z.enum(["imagem", "video", "pdf", "documento", "arquivo", "link"]),
  url: z.string().min(4),
  active: z.boolean().default(true),
});

export const listRelationshipContents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context as never);
    const { listValueContents } = await import("@/server/relationship/homologation.server");
    return listValueContents();
  });

export const saveRelationshipContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => contentSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { saveValueContent } = await import("@/server/relationship/homologation.server");
    return saveValueContent(data);
  });

export const deleteRelationshipContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { deleteValueContent } = await import("@/server/relationship/homologation.server");
    return deleteValueContent(data.id);
  });

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
