/**
 * Central do Executivo — autenticação simples com dados fictícios.
 * Estrutura preparada para futura substituição por um provedor real
 * sem quebrar identificadores internos (o ID é permanente).
 */

export type ExecutiveRole = "super_admin" | "diretora" | "executivo";

export const ROLE_LABEL: Record<ExecutiveRole, string> = {
  super_admin: "Super Administrador",
  diretora: "Diretora de Expansão",
  executivo: "Executivo de Expansão",
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
  return role === "super_admin";
}

export function canViewAllInvestors(role: ExecutiveRole): boolean {
  return role === "super_admin" || role === "diretora";
}

export type ExecutiveUser = {
  id: string;
  name: string;
  username: string;
  password: string;
  slug: string;
  role: ExecutiveRole;
  status: "ativo" | "inativo";
};

const STORAGE_KEY = "velox:executive:session:v2";
const USERS_KEY = "velox:executive:users:v2";

export const SEED_USERS: ExecutiveUser[] = [
  {
    id: "usr_thiago",
    name: "Thiago Rodrigues",
    username: "thiago",
    password: "thiago123",
    slug: "thiago-rodrigues",
    role: "super_admin",
    status: "ativo",
  },
  {
    id: "usr_larissa",
    name: "Larissa",
    username: "larissa",
    password: "larissa123",
    slug: "larissa",
    role: "diretora",
    status: "ativo",
  },
  {
    id: "usr_marton",
    name: "Marton",
    username: "marton",
    password: "marton123",
    slug: "marton",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_paulo",
    name: "Paulo",
    username: "paulo",
    password: "paulo123",
    slug: "paulo",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_milton",
    name: "Milton",
    username: "milton",
    password: "milton123",
    slug: "milton",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_carlos",
    name: "Carlos",
    username: "carlos",
    password: "carlos123",
    slug: "carlos",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_talita",
    name: "Talita",
    username: "talita",
    password: "talita123",
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
    // Garantir que todos os usuários oficiais existam (não podem ser removidos por
    // dados antigos persistidos em localStorage de versões anteriores).
    const byId = new Map(arr.map((u) => [u.id, u] as const));
    for (const seed of SEED_USERS) {
      if (!byId.has(seed.id)) byId.set(seed.id, seed);
    }
    return Array.from(byId.values());
  } catch {
    return SEED_USERS;
  }
}

export function saveUsers(users: ExecutiveUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export type ExecutiveSession = {
  userId: string;
  role: ExecutiveRole;
  name: string;
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
    return { userId: u.id, role: u.role, name: u.name };
  } catch {
    return null;
  }
}

export function signIn(username: string, password: string): ExecutiveSession | null {
  const users = loadUsers();
  const u = users.find(
    (x) =>
      x.username.toLowerCase() === username.trim().toLowerCase() &&
      x.password === password &&
      x.status === "ativo",
  );
  if (!u) return null;
  const s: ExecutiveSession = { userId: u.id, role: u.role, name: u.name };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
  return s;
}

export function signOut() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function newUserId(): string {
  return `usr_${Math.random().toString(36).slice(2, 8)}`;
}