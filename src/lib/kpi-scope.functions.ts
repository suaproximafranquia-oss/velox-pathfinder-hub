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
import { OPERATIONAL_EXECUTIVE_IDS } from "@/lib/teams";

export type KpiScopeEntry = { id: string; name: string };

export type KpiScope = {
  role: "user" | "manager" | "admin";
  selfExecutiveId: string | null;
  selfName: string | null;
  /** Consolidado ("Equipe") existe para gestão/admin, nunca para colaborador. */
  canUseConsolidated: boolean;
  /** Abas individuais autorizadas para este usuário. */
  collaborators: KpiScopeEntry[];
};

type Row = Record<string, unknown>;

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const resolverEscopoKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KpiScope> => {
    // Identidade oficial — import dinâmico porque identity.server é server-only.
    const { resolveServerIdentity } = await import("@/server/identity.server");
    const identity = await resolveServerIdentity(context.userId);
    const role = identity.role;
    const selfId = identity.executiveId;

    const [{ data: profiles, error }, { data: statuses }] = await Promise.all([
      context.supabase.from("executive_profiles").select("executive_id,name"),
      context.supabase
        .from("executive_user_status")
        .select("executive_id,status"),
    ]);
    if (error) throw new Error(error.message);

    const nameById = new Map<string, string>();
    for (const row of (profiles ?? []) as Row[]) {
      const id = text(row, "executive_id");
      const name = text(row, "name");
      if (id) nameById.set(id, name ?? id);
    }
    const inactive = new Set<string>();
    for (const row of (statuses ?? []) as Row[]) {
      const id = text(row, "executive_id");
      if (id && text(row, "status") === "inativo") inactive.add(id);
    }

    // Equipe operacional ativa — mesmo critério de ativo/inativo do Workspace.
    const activeOperational: KpiScopeEntry[] = OPERATIONAL_EXECUTIVE_IDS.filter(
      (id) => !inactive.has(id) && nameById.has(id),
    ).map((id) => ({ id, name: nameById.get(id) ?? id }));

    let collaborators: KpiScopeEntry[];
    if (role === "user") {
      collaborators = selfId
        ? [{ id: selfId, name: identity.name ?? selfId }]
        : [];
    } else if (role === "manager") {
      // Gestora: equipe, sem a própria operação como linha individual.
      collaborators = activeOperational.filter((c) => c.id !== selfId);
    } else {
      // Administrador: equipe completa — a própria operação já está na
      // lista operacional (Thiago), o que habilita a alternância.
      collaborators = activeOperational;
    }

    return {
      role,
      selfExecutiveId: selfId,
      selfName: identity.name,
      canUseConsolidated: role !== "user",
      collaborators,
    };
  });
