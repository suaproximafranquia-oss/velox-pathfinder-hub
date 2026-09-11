import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkspacePortalGateView = { closed: boolean };

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

export const workspacePortalGateStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspacePortalGateView> => {
    await assertAdmin(context as never);
    const { workspacePortalGateStatus } = await import("@/server/crm/workspace-portal-gate.server");
    return workspacePortalGateStatus();
  });

export const closeWorkspacePortalGateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspacePortalGateView> => {
    await assertAdmin(context as never);
    const { closeWorkspacePortalGate } = await import("@/server/crm/workspace-portal-gate.server");
    return closeWorkspacePortalGate(
      context.userId,
      (context.claims as { email?: string }).email ?? "Administrador",
    );
  });

export const openWorkspacePortalGateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspacePortalGateView> => {
    await assertAdmin(context as never);
    const { openWorkspacePortalGate } = await import("@/server/crm/workspace-portal-gate.server");
    return openWorkspacePortalGate();
  });