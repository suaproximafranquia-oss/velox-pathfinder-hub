/**
 * Relógio acelerado da homologação /f — server functions (Admin).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnvironmentClockView = {
  active: boolean;
  factor: number;
  realNowIso: string;
  logicalNowIso: string;
  startedAtReal: string | null;
  startedAtVirtual: string | null;
  leads: Array<{ leadId: string; name: string }>;
};

async function assertAdmin(context: {
  supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}): Promise<void> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Acesso restrito ao Administrador.");
}

export const environmentClockStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnvironmentClockView> => {
    await assertAdmin(context as never);
    const { environmentClockStatus } = await import("@/server/time/environment-clock.server");
    return environmentClockStatus();
  });

export const activateEnvironmentClockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnvironmentClockView> => {
    await assertAdmin(context as never);
    const { activateEnvironmentClock } = await import("@/server/time/environment-clock.server");
    return activateEnvironmentClock(
      context.userId,
      (context.claims as { email?: string }).email ?? "Administrador",
    );
  });

export const deactivateEnvironmentClockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnvironmentClockView> => {
    await assertAdmin(context as never);
    const { deactivateEnvironmentClock } = await import("@/server/time/environment-clock.server");
    return deactivateEnvironmentClock();
  });
