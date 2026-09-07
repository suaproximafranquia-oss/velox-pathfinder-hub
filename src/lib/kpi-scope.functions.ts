/**
 * ESCOPO DO KPI MANAGER — RESOLVIDO NO SERVIDOR.
 *
 * Quem pode ver o quê NÃO é decidido pelo navegador: esta função resolve
 * a identidade pela cadeia oficial (Supabase Auth → executive_profiles →
 * user_roles) e devolve exatamente o recorte autorizado:
 *
 *   Colaborador (user)   → somente o próprio executivo.
 *   Gestora (manager)    → a equipe operacional ativa; nunca "Minha
 *                          operação" (ela não é linha operacional).
 *   Administrador (admin)→ a equipe operacional ativa, incluindo a
 *                          própria operação (pode alternar Equipe × Eu).
 *
 * Nenhum cálculo, fonte ou fórmula de KPI é tocado aqui — apenas QUEM
 * aparece no recorte. Executivos inativos nunca entram na visão
 * operacional atual.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { KpiScope, KpiScopeEntry } from "@/server/kpi/kpi-scope.server";

export type { KpiScope, KpiScopeEntry };

/**
 * A REGRA vive em `@/server/kpi/kpi-scope.server` e é a mesma usada
 * pela leitura/gravação dos lançamentos — não existe segunda matriz.
 */
export const resolverEscopoKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KpiScope> => {
    const { resolveKpiScope } = await import("@/server/kpi/kpi-scope.server");
    return resolveKpiScope(context.userId, context.supabase as never);
  });

