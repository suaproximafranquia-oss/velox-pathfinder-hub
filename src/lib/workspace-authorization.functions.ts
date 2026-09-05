/**
 * Ponte cliente ↔ servidor da autorização única do Corporate Workspace.
 *
 * A interface NUNCA decide sozinha: pergunta ao servidor qual é o papel
 * efetivo e quais recursos estão liberados. O que chega aqui é o mesmo
 * resultado usado pelas server functions protegidas.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExecutiveRole } from "@/lib/executive-auth";
import type { WorkspaceModuleKey } from "@/lib/workspace-permissions";
import type { WorkspaceResource } from "@/lib/workspace-authorization";

export type WorkspaceAuthorizationSnapshot = {
  role: ExecutiveRole;
  modules: Partial<Record<WorkspaceModuleKey, boolean>>;
  allowed: Record<WorkspaceResource, boolean>;
};

export const autorizacaoWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceAuthorizationSnapshot> => {
    const { readWorkspaceAuthorization } = await import(
      "@/server/workspace-authorization.server"
    );
    return (await readWorkspaceAuthorization(context as never)) as WorkspaceAuthorizationSnapshot;
  });
