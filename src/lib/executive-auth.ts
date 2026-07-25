/**
 * Central do Executivo — autenticação simples com dados fictícios.
 * Estrutura preparada para futura substituição por um provedor real
 * sem quebrar identificadores internos (o ID é permanente).
 */

export type ExecutiveRole = "gestor" | "executivo";

export type ExecutiveUser = {
  id: string;
  name: string;
  username: string;
  password: string;
  slug: string;
  role: ExecutiveRole;
  status: "ativo" | "inativo";
};

const STORAGE_KEY = "velox:executive:session:v1";
const USERS_KEY = "velox:executive:users:v1";

export const SEED_USERS: ExecutiveUser[] = [
  {
    id: "usr_001",
    name: "Maria Andrade",
    username: "gestor",
    password: "gestor123",
    slug: "maria-andrade",
    role: "gestor",
    status: "ativo",
  },
  {
    id: "usr_002",
    name: "Rafael Torres",
    username: "executivo",
    password: "executivo123",
    slug: "rafael-torres",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_003",
    name: "Carla Menezes",
    username: "carla",
    password: "carla123",
    slug: "carla-menezes",
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
    return arr;
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
    return JSON.parse(raw) as ExecutiveSession;
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