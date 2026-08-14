/**
 * Acesso da interface à fila de execução comercial.
 * Somente gestão autenticada; o navegador nunca fala com a origem.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CadenceQueueView = {
  leadId: string;
  externalId: string;
  name: string;
  phone: string;
  stageKey: string | null;
  entryDate: string;
  step: number;
  dueDate: string;
  overdue: boolean;
};

async function assertManager(context: { supabase: never; userId: string }) {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>;
  };
  const [admin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!admin.data && !manager.data) throw new Error("Acesso restrito à gestão do CRM.");
}

/** Fila do dia — recalculada a cada leitura a partir do estado da origem. */
export const listCadenceQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ channel: z.enum(["call", "message"]).default("call") }).parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<CadenceQueueView[]> => {
    await assertManager(context as never);
    const { buildCadenceQueue } = await import("@/server/crm/cadence.server");
    return buildCadenceQueue(data.channel);
  });

/** Registra a tentativa do dia — não exclui o lead nem encerra a cadência. */
export const completeCadenceTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leadId: z.string().uuid(),
        step: z.number().int().positive(),
        dueDate: z.string(),
        channel: z.enum(["call", "message"]).default("call"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { completeCadenceTask } = await import("@/server/crm/cadence.server");
    await completeCadenceTask({ ...data, userId: context.userId });
    return { ok: true as const };
  });