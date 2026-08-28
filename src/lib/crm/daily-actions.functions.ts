/**
 * Acesso da interface às Ações do Dia.
 * Somente gestão autenticada; o navegador nunca fala com a origem.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DailyAction, DailyActionsSummary } from "@/lib/crm/daily-actions";

async function assertManager(context: { supabase: never; userId: string }) {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const [admin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!admin.data && !manager.data) throw new Error("Acesso restrito à gestão do CRM.");
}

async function currentExecutiveId(context: { supabase: never }): Promise<string | null> {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const { data } = await supabase.rpc("current_executive_id");
  return typeof data === "string" && data ? data : null;
}

/** Lista única do dia — recalculada a cada leitura a partir das fontes. */
export const listDailyActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyAction[]> => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { buildDailyActions } = await import("@/server/crm/daily-actions.server");
    return buildDailyActions({ executiveId });
  });

/** Contador discreto do botão: atrasadas x hoje x reuniões. */
export const getDailyActionsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyActionsSummary> => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { buildDailyActions } = await import("@/server/crm/daily-actions.server");
    const { summarizeDailyActions } = await import("@/lib/crm/daily-actions");
    return summarizeDailyActions(await buildDailyActions({ executiveId }));
  });
