/**
 * Central do Executivo — autenticação simples com dados fictícios.
 * Estrutura preparada para futura substituição por um provedor real
 * sem quebrar identificadores internos (o ID é permanente).
 */

export type ExecutiveRole = "super_admin" | "diretora" | "executivo";

/**
 * Perfis oficiais da Atlas Platform. Mantemos os identificadores legados
 * (super_admin, diretora, executivo) para compatibilidade interna com
 * dados persistidos, mas a superfície de gestão trabalha apenas com os
 * três perfis universais da plataforma:
 *   Administrador (super_admin)
 *   Gestor        (diretora)
 *   Colaborador   (executivo)
 * Estes perfis são universais e independem do organograma do workspace.
 */
export const ROLE_LABEL: Record<ExecutiveRole, string> = {
  super_admin: "Administrador",
  diretora: "Gestor",
  executivo: "Colaborador",
};

/**
 * Origem dos leads — estrutura de dados preparada para futuras integrações.
 * Nenhuma funcionalidade implementada nesta etapa.
 */
export type LeadOrigin =
  | "greensales"
  | "manual_publico"
  | "trafego_pago"
  | "indicacao"
  | "teste"
  | "lead_privado";

export const LEAD_ORIGIN_LABEL: Record<LeadOrigin, string> = {
  greensales: "GreenSales",
  manual_publico: "Manual Público",
  trafego_pago: "Tráfego Pago",
  indicacao: "Indicação",
  teste: "Teste",
  lead_privado: "Lead Privado",
};

/**
 * Permissões — apenas o Super Administrador pode visualizar Leads Privados.
 * Estrutura preparada; nenhuma tela de Leads Privados é criada nesta etapa.
 */
export function canViewPrivateLeads(role: ExecutiveRole): boolean {
  return role === "super_admin";
}

export function canManageUsers(role: ExecutiveRole): boolean {
  // Administradores e Gestores podem gerir usuários; Gestores com escopo
  // restrito a Colaboradores (ver canManageTargetUser).
  return role === "super_admin" || role === "diretora";
}

/**
 * Verifica se o perfil `actor` pode alterar/excluir/promover um usuário
 * cujo perfil atual é `target`. Aplica a matriz de permissões oficial:
 *   Administrador → qualquer alvo, qualquer perfil.
 *   Gestor       → apenas Colaboradores (não pode tocar em Administradores
 *                  nem em outros Gestores existentes; pode PROMOVER
 *                  Colaboradores a Gestor).
 *   Colaborador  → nenhum alvo.
 */
export function canManageTargetUser(
  actor: ExecutiveRole,
  target: ExecutiveRole,
): boolean {
  if (actor === "super_admin") return true;
  if (actor === "diretora") return target === "executivo";
  return false;
}

/**
 * Perfis que `actor` pode atribuir a um usuário (criação ou promoção).
 * Gestor NÃO pode criar/atribuir Administradores.
 */
export function assignableRoles(actor: ExecutiveRole): ExecutiveRole[] {
  if (actor === "super_admin")
    return ["super_admin", "diretora", "executivo"];
  if (actor === "diretora") return ["diretora", "executivo"];
  return [];
}

export function canViewAllInvestors(role: ExecutiveRole): boolean {
  return role === "super_admin" || role === "diretora";
}

/** Peso hierárquico usado para determinar quais perfis um usuário pode assumir. */
const ROLE_WEIGHT: Record<ExecutiveRole, number> = {
  super_admin: 3,
  diretora: 2,
  executivo: 1,
};

/**
 * Perfis que um usuário pode assumir para navegação/teste. Um Administrador
 * pode atuar como Gestor ou Colaborador; um Gestor pode atuar como Colaborador;
 * um Colaborador só pode ser Colaborador.
 */
export function availableRoles(grantedRole: ExecutiveRole): ExecutiveRole[] {
  const w = ROLE_WEIGHT[grantedRole];
  return (Object.keys(ROLE_WEIGHT) as ExecutiveRole[]).filter(
    (r) => ROLE_WEIGHT[r] <= w,
  );
}

/** Retorna a permissão para acessar o módulo Central de Conhecimento. */
export function canManageKnowledge(role: ExecutiveRole): boolean {
  return role === "super_admin" || role === "diretora";
}

/**
 * Estrutura do usuário — preparada para gestão dinâmica pelo Administrador
 * do Workspace. Ao criar um novo usuário, a plataforma deverá provisionar
 * automaticamente perfil, área individual, permissões e demais estruturas
 * necessárias, sem necessidade de código.
 */
export type ExecutiveUser = {
  id: string;
  /** Workspace ao qual o usuário pertence. Isolamento multi-tenant. */
  workspaceId: string;
  name: string;
  /** E-mail corporativo — identificador de login. */
  email: string;
  /** Telefone corporativo (opcional). */
  phone?: string;
  /** Mantido para compatibilidade com telas legadas; deriva do e-mail. */
  username: string;
  /** Senha inicial (será substituída por hash no backend real). */
  password: string;
  /** Slug interno da área individual do usuário. */
  slug: string;
  role: ExecutiveRole;
  status: "ativo" | "inativo";
};

const STORAGE_KEY = "atlas:session:v3";
const USERS_KEY = "atlas:users:v3";
const ACTIVE_ROLE_KEY = "atlas:activeRole:v1";

const WORKSPACE_VELOX = "velox";
const LEAD_ORIGIN_ONLY_USER_IDS = new Set(["usr_joao", "usr_felipe"]);

export const SEED_USERS: ExecutiveUser[] = [
  {
    id: "usr_thiago",
    workspaceId: WORKSPACE_VELOX,
    name: "Thiago Rodrigues",
    email: "thiago.rodrigues@veloxsolucoes.com.br",
    username: "thiago.rodrigues",
    password: "VLX_Th48",
    slug: "thiago-rodrigues",
    role: "super_admin",
    status: "ativo",
  },
  {
    id: "usr_larissa",
    workspaceId: WORKSPACE_VELOX,
    name: "Larissa",
    email: "larissa@velox.com.br",
    username: "larissa",
    password: "VLX_La73",
    slug: "larissa",
    role: "diretora",
    status: "ativo",
  },
  {
    id: "usr_marton",
    workspaceId: WORKSPACE_VELOX,
    name: "Marton",
    email: "marton@velox.com.br",
    username: "marton",
    password: "VLX_Ma61",
    slug: "marton",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_paulo",
    workspaceId: WORKSPACE_VELOX,
    name: "Paulo",
    email: "paulo@velox.com.br",
    username: "paulo",
    password: "VLX_Pa29",
    slug: "paulo",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_milton",
    workspaceId: WORKSPACE_VELOX,
    name: "Milton",
    email: "milton@velox.com.br",
    username: "milton",
    password: "VLX_Mi54",
    slug: "milton",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_carlos",
    workspaceId: WORKSPACE_VELOX,
    name: "Carlos",
    email: "carlos@velox.com.br",
    username: "carlos",
    password: "VLX_Ca87",
    slug: "carlos",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_talita",
    workspaceId: WORKSPACE_VELOX,
    name: "Talita",
    email: "talita@velox.com.br",
    username: "talita",
    password: "VLX_Ta36",
    slug: "talita",
    role: "executivo",
    status: "ativo",
  },
];

export function loadUsers(): ExecutiveUser[] {
  if (typeof window === "undefined") return SEED_USERS;
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return SEED_USERS;
    const arr = JSON.parse(raw) as ExecutiveUser[];
    if (!Array.isArray(arr) || arr.length === 0) return SEED_USERS;
    // Garante que os usuários oficiais existam e mantenham credenciais
    // sincronizadas com o seed atual (previne conflitos com versões
    // anteriores da estrutura persistida no localStorage).
    const byId = new Map(
      arr
        .filter((u) => !LEAD_ORIGIN_ONLY_USER_IDS.has(u.id))
        .map((u) => [u.id, u] as const),
    );
    for (const seed of SEED_USERS) byId.set(seed.id, seed);
    return Array.from(byId.values());
  } catch {
    return SEED_USERS;
  }
}

export function saveUsers(users: ExecutiveUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    USERS_KEY,
    JSON.stringify(users.filter((u) => !LEAD_ORIGIN_ONLY_USER_IDS.has(u.id))),
  );
}

export type ExecutiveSession = {
  userId: string;
  workspaceId: string;
  /** Perfil real concedido ao usuário (nunca muda no cliente). */
  role: ExecutiveRole;
  /** Perfil ativo escolhido pelo usuário — sempre ≤ role. */
  activeRole: ExecutiveRole;
  name: string;
  email: string;
};

export function getSession(): ExecutiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ExecutiveSession;
    // Sessão só é válida se o usuário existir na base atual.
    const users = loadUsers();
    const u = users.find((x) => x.id === s.userId && x.status === "ativo");
    if (!u) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      userId: u.id,
      workspaceId: u.workspaceId,
      role: u.role,
      activeRole: readActiveRole(u.role),
      name: u.name,
      email: u.email,
    };
  } catch {
    return null;
  }
}

function readActiveRole(granted: ExecutiveRole): ExecutiveRole {
  if (typeof window === "undefined") return granted;
  const raw = window.localStorage.getItem(ACTIVE_ROLE_KEY) as ExecutiveRole | null;
  if (!raw) return granted;
  return availableRoles(granted).includes(raw) ? raw : granted;
}

export function setActiveRole(session: ExecutiveSession, role: ExecutiveRole) {
  if (!availableRoles(session.role).includes(role)) return;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_ROLE_KEY, role);
  }
}

export function signIn(email: string, password: string): ExecutiveSession | null {
  const users = loadUsers();
  const key = email.trim().toLowerCase();
  const u = users.find(
    (x) =>
      x.email.toLowerCase() === key &&
      x.password === password &&
      x.status === "ativo",
  );
  if (!u) return null;
  const s: ExecutiveSession = {
    userId: u.id,
    workspaceId: u.workspaceId,
    role: u.role,
    activeRole: u.role,
    name: u.name,
    email: u.email,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.localStorage.removeItem(ACTIVE_ROLE_KEY);
  }
  return s;
}

export function signOut() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(ACTIVE_ROLE_KEY);
}

export function newUserId(): string {
  return `usr_${Math.random().toString(36).slice(2, 8)}`;
}