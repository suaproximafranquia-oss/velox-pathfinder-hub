/**
 * PROTEÇÃO DO AMBIENTE DE HOMOLOGAÇÃO (Etapa 2 §8 e §9).
 *
 * Camada anterior a qualquer URL do ambiente. NÃO substitui o login do
 * CRM, da Central Administrativa nem do Portal do Investidor: apenas
 * impede que o ambiente de testes fique exposto publicamente.
 *
 * A sessão permanece ativa no navegador até logout, limpeza de dados,
 * outro navegador, aba anônima ou expiração.
 */

export type HomologationUser = { username: string; password: string };

export type HomologationConfig = {
  enabled: boolean;
  users: HomologationUser[];
};

const CONFIG_KEY = "velox.homologacao.config.v1";
const SESSION_KEY = "velox.homologacao.session.v1";
/** Sessão longa: 30 dias no mesmo navegador. */
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG: HomologationConfig = {
  enabled: true,
  users: [
    { username: "Thiago", password: "Velox@2026" },
    { username: "Mario", password: "Velox@2026" },
  ],
};

export function loadHomologationConfig(): HomologationConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<HomologationConfig>;
    const users = Array.isArray(parsed.users)
      ? parsed.users.filter((u) => u && typeof u.username === "string" && u.username.trim())
      : DEFAULT_CONFIG.users;
    return { enabled: parsed.enabled !== false, users };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveHomologationConfig(config: HomologationConfig): HomologationConfig {
  if (typeof window === "undefined") return config;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* configuração é local ao ambiente de homologação */
  }
  return config;
}

export function isHomologationUnlocked(): boolean {
  if (typeof window === "undefined") return true;
  const config = loadHomologationConfig();
  if (!config.enabled) return true;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw) as { username?: string; at?: number };
    if (!session.username || !session.at) return false;
    if (Date.now() - session.at > SESSION_TTL) return false;
    return config.users.some((u) => u.username === session.username);
  } catch {
    return false;
  }
}

export function signInHomologation(username: string, password: string): boolean {
  const config = loadHomologationConfig();
  const user = config.users.find(
    (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase(),
  );
  if (!user || user.password !== password) return false;
  try {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ username: user.username, at: Date.now() }),
    );
  } catch {
    /* sem persistência, a proteção volta a pedir acesso */
  }
  return true;
}

export function signOutHomologation() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}