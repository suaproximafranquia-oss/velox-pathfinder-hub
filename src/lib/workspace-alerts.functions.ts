/**
 * Central de Alertas — leitura autenticada (server-side).
 *
 * A Central REAL passa a ler daqui. O recorte por executivo responsável é
 * feito pelas políticas RLS já existentes das tabelas de origem: nenhuma
 * consulta privilegiada e nenhum acesso ampliado é introduzido.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ServerWorkspaceAlert } from "@/server/workspace/alerts.server";

export type { ServerWorkspaceAlert };

export const listServerWorkspaceAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServerWorkspaceAlert[]> => {
    const { buildWorkspaceAlerts } = await import("@/server/workspace/alerts.server");
    return buildWorkspaceAlerts(context.supabase);
  });
