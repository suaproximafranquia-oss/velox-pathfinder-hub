import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DailyAction } from "@/lib/crm/daily-actions";

export type ControlledTestSnapshot = {
  status: {
    active: boolean;
    runId: string | null;
    realNowIso: string;
    logicalNowIso: string;
    factor: number;
    leads: Array<{ leadId: string; name: string; phoneSuffix: string }>;
    counts: { cadences: number; queue: number; events: number; decisions: number };
  };
  actions: DailyAction[];
};

async function assertAdmin(context: {
  supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}): Promise<void> {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito ao Administrador.");
}

export const controlledTestStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { controlledTestActions } = await import("@/server/relationship/controlled-test.server");
    return controlledTestActions();
  });

export const activateControlledTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { activateControlledTest, controlledTestActions } = await import("@/server/relationship/controlled-test.server");
    await activateControlledTest(context.userId, (context.claims as { email?: string }).email ?? "Administrador");
    return controlledTestActions();
  });

export const tickControlledTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { runControlledTestTick, controlledTestActions } = await import("@/server/relationship/controlled-test.server");
    await runControlledTestTick();
    return controlledTestActions();
  });

export const concludeControlledActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ queueItemId: z.string().min(1), outcome: z.enum(["SIM", "NAO"]).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { concludeControlledAction } = await import("@/server/relationship/controlled-test.server");
    return concludeControlledAction(data);
  });

export const deactivateControlledTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ confirmed: z.literal(true) }).parse(data))
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { deactivateControlledTest } = await import("@/server/relationship/controlled-test.server");
    return { status: await deactivateControlledTest(), actions: [] };
  });
