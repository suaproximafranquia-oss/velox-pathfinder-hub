/**
 * Identidade do Investidor — camada permanente da plataforma.
 *
 * A Identidade é independente do Lead e da Sessão. Um Lead é um registro
 * comercial; uma Sessão é um contexto de navegação; a Identidade é a
 * pessoa. Nesta etapa **não** há merge automático (WhatsApp, telefone ou
 * dispositivos) — a estrutura apenas já suporta múltiplos e-mails,
 * telefones, dispositivos e sessões para que a consolidação futura não
 * exija refatoração.
 */

const IDENTITIES_KEY = "velox:portal:identities:v1";

export type PortalIdentity = {
  /** Identificador permanente da pessoa (nunca reutilizado por Lead). */
  id: string;
  name: string;
  /** Múltiplos e-mails desde já — o primeiro é o principal. */
  emails: string[];
  /** Preparado para consolidação futura por WhatsApp/telefone. */
  phones: string[];
  /** Dispositivos/navegadores conhecidos. */
  devices: string[];
  /** Sessões já criadas por esta identidade. */
  sessionIds: string[];
  /** Leads gerados por esta identidade (relação 1:N). */
  leadIds: string[];
  createdAt: string;
  updatedAt: string;
};

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function listIdentities(): PortalIdentity[] {
  return safeRead<PortalIdentity[]>(IDENTITIES_KEY) ?? [];
}

function persist(all: PortalIdentity[]) {
  safeWrite(IDENTITIES_KEY, all);
}

export function getIdentity(id: string): PortalIdentity | null {
  return listIdentities().find((i) => i.id === id) ?? null;
}

export function findIdentityByEmail(email: string): PortalIdentity | null {
  const normalized = normalizeEmail(email);
  return listIdentities().find((i) => i.emails.includes(normalized)) ?? null;
}

export function deviceFingerprint(): string {
  if (typeof window === "undefined") return "server";
  return [
    window.navigator.platform ?? "unknown",
    window.navigator.language ?? "",
    `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
  ].join("|");
}

function pushUnique(list: string[], value?: string | null): string[] {
  if (!value) return list;
  return list.includes(value) ? list : [...list, value];
}

/**
 * Resolve (ou cria) a identidade permanente para os dados informados no
 * Gateway. Nunca duplica um e-mail já conhecido.
 */
export function resolveIdentity(input: {
  name: string;
  email: string;
  phone?: string;
}): PortalIdentity {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const all = listIdentities();
  const existing = all.find((i) => i.emails.includes(email));

  if (existing) {
    existing.name = input.name.trim() || existing.name;
    existing.emails = pushUnique(existing.emails, email);
    existing.phones = pushUnique(existing.phones, input.phone?.trim());
    existing.devices = pushUnique(existing.devices, deviceFingerprint());
    existing.updatedAt = now;
    persist(all);
    return existing;
  }

  const identity: PortalIdentity = {
    id: `idt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    emails: [email],
    phones: input.phone?.trim() ? [input.phone.trim()] : [],
    devices: [deviceFingerprint()],
    sessionIds: [],
    leadIds: [],
    createdAt: now,
    updatedAt: now,
  };
  all.push(identity);
  persist(all);
  return identity;
}

export function attachSessionToIdentity(identityId: string, sessionId: string) {
  const all = listIdentities();
  const identity = all.find((i) => i.id === identityId);
  if (!identity) return;
  identity.sessionIds = pushUnique(identity.sessionIds, sessionId);
  identity.updatedAt = new Date().toISOString();
  persist(all);
}

export function attachLeadToIdentity(identityId: string, leadId: string) {
  const all = listIdentities();
  const identity = all.find((i) => i.id === identityId);
  if (!identity) return;
  identity.leadIds = pushUnique(identity.leadIds, leadId);
  identity.updatedAt = new Date().toISOString();
  persist(all);
}
