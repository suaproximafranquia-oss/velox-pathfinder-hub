import { isReservedSlug } from "@/lib/business-unit";

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
export function canManageTargetUser(actor: ExecutiveRole, target: ExecutiveRole): boolean {
  if (actor === "super_admin") return true;
  if (actor === "diretora") return target === "executivo";
  return false;
}

/**
 * Perfis que `actor` pode atribuir a um usuário (criação ou promoção).
 * Gestor NÃO pode criar/atribuir Administradores.
 */
export function assignableRoles(actor: ExecutiveRole): ExecutiveRole[] {
  if (actor === "super_admin") return ["super_admin", "diretora", "executivo"];
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
 * Perfis que um usuário pode assumir para navegação/teste.
 *
 * ATUALIZAÇÃO ESTRUTURAL §2 — perfil REAL e perfil ATIVO são coisas
 * distintas. O Administrador alterna apenas entre Administrador e
 * Colaborador: ele nunca assume "Gestor", porque a Gestão possui uma
 * carteira própria (Central Única) que não lhe pertence. O perfil real
 * da Gestora permanece intacto — ela continua alternando para
 * Colaborador quando quiser.
 */
export function availableRoles(grantedRole: ExecutiveRole): ExecutiveRole[] {
  if (grantedRole === "super_admin") return ["super_admin", "executivo"];
  const w = ROLE_WEIGHT[grantedRole];
  return (Object.keys(ROLE_WEIGHT) as ExecutiveRole[]).filter((r) => ROLE_WEIGHT[r] <= w);
}


/** Retorna a permissão para acessar o módulo Central de Conhecimento. */
export function canManageKnowledge(role: ExecutiveRole): boolean {
  return role === "super_admin" || role === "diretora";
}

/**
 * Templates da IA Criativa: apenas Administrador e Gestora podem enviar,
 * substituir ou remover. Executivos e colaboradores apenas utilizam.
 */
export function canManageCreativeTemplates(role: ExecutiveRole): boolean {
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
  /** WhatsApp corporativo (opcional). Quando ausente, cai em `phone`. */
  whatsapp?: string;
  /** Cargo institucional exibido em perfil e Manual personalizado. */
  title?: string;
  /**
   * Foto institucional do colaborador (data URL). Arquitetura preparada
   * para uso em toda a plataforma; quando ausente, usa-se o avatar padrão
   * com as iniciais do nome oficial.
   */
  photoUrl?: string;
  /**
   * COMANDO 3D §17 — vídeo de pós-apresentação INDIVIDUAL do executivo.
   * Nunca há fallback para o link de outro executivo: sem este valor a
   * ação manual de Pós-apresentação permanece bloqueada.
   */
  postPresentationVideoUrl?: string;
  /** Data de admissão (ISO). Origem única para Recognition e Perfil. */
  admissionDate?: string;
  /** Data de nascimento (ISO). Utilizada por notificações e automações internas. */
  birthDate?: string;
  /** Gestor direto — referência para hierarquia visual (opcional). */
  gestorId?: string;
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
    phone: "5517997727337",
    title: "Gerente de Expansão",
    admissionDate: "2020-01-15",
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
    email: "larissa@veloxsolucoes.com.br",
    phone: "5517997727337",
    title: "Diretora Comercial",
    admissionDate: "2021-03-10",
    gestorId: "usr_thiago",
    username: "larissa",
    password: "Velox@2026",
    slug: "larissa",
    role: "diretora",
    status: "ativo",
  },
  {
    id: "usr_marton",
    workspaceId: WORKSPACE_VELOX,
    name: "Marton",
    email: "marton@veloxsolucoes.com.br",
    phone: "5517997727337",
    title: "Executivo de Negócios",
    admissionDate: "2023-05-02",
    gestorId: "usr_larissa",
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
    email: "paulo@veloxsolucoes.com.br",
    phone: "5517997727337",
    title: "Executivo de Negócios",
    admissionDate: "2023-08-14",
    gestorId: "usr_larissa",
    username: "paulo",
    password: "Velox@2026",
    slug: "paulo",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_milton",
    workspaceId: WORKSPACE_VELOX,
    name: "Milton",
    email: "milton@veloxsolucoes.com.br",
    phone: "5517997727337",
    title: "Executivo de Negócios",
    admissionDate: "2024-02-01",
    gestorId: "usr_larissa",
    username: "milton",
    password: "Velox@2026",
    slug: "milton",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_carlos",
    workspaceId: WORKSPACE_VELOX,
    name: "Carlos",
    email: "carlos@veloxsolucoes.com.br",
    phone: "5517997727337",
    title: "Executivo de Negócios",
    admissionDate: "2024-06-20",
    gestorId: "usr_larissa",
    username: "carlos",
    password: "Velox@2026",
    slug: "carlos",
    role: "executivo",
    status: "ativo",
  },
  {
    id: "usr_talita",
    workspaceId: WORKSPACE_VELOX,
    name: "Talita",
    email: "talita@veloxsolucoes.com.br",
    phone: "5517997727337",
    title: "Executiva de Negócios",
    admissionDate: "2025-01-08",
    gestorId: "usr_larissa",
    username: "talita",
    password: "Velox@2026",
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
      arr.filter((u) => !LEAD_ORIGIN_ONLY_USER_IDS.has(u.id)).map((u) => [u.id, u] as const),
    );
    for (const seed of SEED_USERS) {
      const stored = byId.get(seed.id);
      // Credenciais/estrutura vêm do seed; os dados pessoais editados pelo
      // colaborador (foto, WhatsApp, datas, nome) são preservados.
      byId.set(
        seed.id,
        stored
          ? {
              ...seed,
              name: stored.name || seed.name,
              phone: stored.phone ?? seed.phone,
              whatsapp: stored.whatsapp ?? seed.whatsapp,
              photoUrl: stored.photoUrl ?? seed.photoUrl,
              postPresentationVideoUrl:
                stored.postPresentationVideoUrl ?? seed.postPresentationVideoUrl,
              admissionDate: stored.admissionDate ?? seed.admissionDate,
              birthDate: stored.birthDate ?? seed.birthDate,
            }
          : seed,
      );
    }
    return Array.from(byId.values());
  } catch {
    return SEED_USERS;
  }
}

/** Erro lançado quando a persistência recebe um link personalizado inválido. */
export class InvalidExecutiveSlugError extends Error {
  readonly suggestion: string;
  constructor(message: string, suggestion: string) {
    super(message);
    this.name = "InvalidExecutiveSlugError";
    this.suggestion = suggestion;
  }
}

export function saveUsers(users: ExecutiveUser[]) {
  if (typeof window === "undefined") return;
  // §Slugs — a validação é BLOQUEANTE no ponto de persistência: nenhum
  // usuário pode ser gravado com um endereço reservado pela unidade.
  for (const user of users) {
    if (!user.slug) continue;
    const check = validateExecutiveSlug(user.slug);
    if (!check.ok) {
      throw new InvalidExecutiveSlugError(check.message, check.suggestion);
    }
  }
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
    (x) => x.email.toLowerCase() === key && x.password === password && x.status === "ativo",
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
  // Encerra também a sessão real no backend (usada pelas integrações Google).
  void import("@/integrations/supabase/client")
    .then(({ supabase }) => supabase.auth.signOut())
    .catch(() => undefined);
}

/**
 * Login oficial: valida as credenciais do workspace e abre, em paralelo,
 * a sessão autenticada no backend — necessária para as integrações
 * Google (Calendar, Meet, Drive e Gmail) operarem com credencial própria
 * de cada executivo.
 */
export async function signInWithCloud(
  email: string,
  password: string,
): Promise<ExecutiveSession | null> {
  const session = signIn(email, password);
  if (!session) return null;
  try {
    const [{ supabase }, { ensureExecutiveAuthUser }] = await Promise.all([
      import("@/integrations/supabase/client"),
      import("@/lib/executive-auth.functions"),
    ]);
    const provisioned = await ensureExecutiveAuthUser({ data: { email, password } });
    if (provisioned.ok) {
      await supabase.auth.signInWithPassword({ email, password });
    } else if (provisioned.reason === "inativo") {
      // §13 — o servidor é a autoridade: perfil desativado NÃO entra.
      signOut();
      return null;
    }
  } catch {
    /* o acesso ao workspace nunca é bloqueado por indisponibilidade externa */
  }
  return session;
}

export function newUserId(): string {
  return `usr_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Garante que a sessão autenticada do backend esteja ativa para o executivo
 * já logado no workspace. Reaproveita exatamente o mesmo mecanismo do login
 * oficial — nenhuma autenticação paralela é criada.
 */
export async function ensureCloudSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return true;

    const session = getSession();
    if (!session) return false;
    const user = loadUsers().find(
      (u) => u.email.toLowerCase() === session.email.toLowerCase() && u.status === "ativo",
    );
    if (!user) return false;

    const { ensureExecutiveAuthUser } = await import("@/lib/executive-auth.functions");
    const provisioned = await ensureExecutiveAuthUser({
      data: { email: user.email, password: user.password },
    });
    if (!provisioned.ok) return false;
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    return !error;
  } catch {
    return false;
  }
}

/* ---------------------- Resolução do Executivo Responsável ---------------------- */

import { WORKSPACE } from "@/config/workspace";

/**
 * Retorna o Executivo Padrão do workspace ativo. A ordem de resolução é:
 *   1. `WORKSPACE.defaultExecutiveId` — quando a tela "Configurações da
 *      Plataforma" preencher esse parâmetro no futuro.
 *   2. Primeiro Administrador (`super_admin`) ativo — fallback temporário
 *      para demonstração. Nenhum nome é fixado em código.
 *   3. `null` — se o workspace ficar sem nenhum usuário elegível.
 */
export function getDefaultExecutive(): ExecutiveUser | null {
  const users = loadUsers().filter((u) => u.status === "ativo");
  const configured = WORKSPACE.defaultExecutiveId
    ? users.find((u) => u.id === WORKSPACE.defaultExecutiveId)
    : null;
  if (configured) return configured;
  return users.find((u) => u.role === "super_admin") ?? users[0] ?? null;
}

/** Localiza um executivo ativo pelo slug do link personalizado. */
export function getExecutiveBySlug(slug: string): ExecutiveUser | null {
  const key = slug.trim().toLowerCase();
  // Slugs reservados pertencem à unidade de negócio (/f/executivo, /f/crm…)
  // e jamais resolvem para um link personalizado.
  if (!key || isReservedSlug(key)) return null;
  return loadUsers().find((u) => u.slug.toLowerCase() === key && u.status === "ativo") ?? null;
}
