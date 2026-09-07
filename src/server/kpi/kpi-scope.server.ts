/**
 * ESCOPO DO KPI — REGRA ÚNICA, RESOLVIDA NO SERVIDOR.
 *
 * Este é o MESMO recorte usado pela tela (`resolverEscopoKpi`) e pela
 * leitura/gravação dos lançamentos. Não existe segunda matriz de
 * autorização: quem pode ver/lançar o quê é decidido aqui.
 *
 *   Colaborador (user)    → somente o próprio executivo.
 *   Gestora (manager)     → equipe operacional ativa; nunca "Eu".
 *   Administrador (admin) → equipe operacional ativa, incluindo a si.
 */
export type KpiScopeEntry = { id: string; name: string };

export type KpiScope = {
  role: "user" | "manager" | "admin";
  selfExecutiveId: string | null;
  selfName: string | null;
  canUseConsolidated: boolean;
  collaborators: KpiScopeEntry[];
};

type Row = Record<string, unknown>;

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => Promise<{ data: unknown; error: unknown }>;
  };
};

export async function resolveKpiScope(
  userId: string,
  supabase: SupabaseLike,
): Promise<KpiScope> {
  const { resolveServerIdentity } = await import("@/server/identity.server");
  const identity = await resolveServerIdentity(userId);
  const role = identity.role;
  const selfId = identity.executiveId;

  const { data: profiles, error } = await supabase
    .from("executive_profiles")
    .select("executive_id,name");
  if (error) throw new Error((error as { message?: string }).message ?? "Falha ao ler executivos.");

  const nameById = new Map<string, string>();
  for (const row of ((profiles ?? []) as Row[])) {
    const id = text(row, "executive_id");
    const name = text(row, "name");
    if (id) nameById.set(id, name ?? id);
  }

  // Equipe operacional ativa — fonte única no servidor (sem gestão,
  // sem inativos, com executivos novos entrando automaticamente).
  const { listActiveOperationalExecutives } = await import(
    "@/server/operational-team.server"
  );
  const activeOperational: KpiScopeEntry[] = (
    await listActiveOperationalExecutives()
  ).map((entry) => ({ id: entry.id, name: nameById.get(entry.id) ?? entry.name }));

  let collaborators: KpiScopeEntry[];
  if (role === "user") {
    collaborators = selfId ? [{ id: selfId, name: identity.name ?? selfId }] : [];
  } else if (role === "manager") {
    collaborators = activeOperational.filter((c) => c.id !== selfId);
  } else {
    collaborators = activeOperational;
  }

  return {
    role,
    selfExecutiveId: selfId,
    selfName: identity.name,
    canUseConsolidated: role !== "user",
    collaborators,
  };
}

/**
 * Executivos que este usuário pode LER. Consolidado = todos do recorte.
 * Um id fora do recorte nunca é aceito, venha de onde vier.
 */
export function readableExecutiveIds(
  scope: KpiScope,
  requestedExecutiveId: string | null,
): string[] {
  const allowed = scope.collaborators.map((c) => c.id);
  if (!requestedExecutiveId) {
    // Consolidado: colaborador só tem a si mesmo; gestão/admin têm a equipe.
    return allowed;
  }
  return allowed.includes(requestedExecutiveId) ? [requestedExecutiveId] : [];
}

/**
 * Quem pode GRAVAR/LIMPAR os lançamentos de um executivo.
 * Colaborador: só os próprios. Gestão/Admin: os do recorte autorizado.
 */
export function canWriteExecutive(scope: KpiScope, executiveId: string): boolean {
  if (!executiveId) return false;
  if (scope.role === "user") return executiveId === scope.selfExecutiveId;
  return scope.collaborators.some((c) => c.id === executiveId);
}
