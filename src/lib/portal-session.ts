/**
 * Sessão do Portal Velox — contexto oficial da navegação.
 *
 * A Sessão é criada exclusivamente pelo Gateway (overlay da Home) e
 * passa a ser a referência única de todos os módulos: nenhum módulo cria
 * sessão própria. Ela guarda identidade, executivo responsável, unidade,
 * origem, status da jornada e histórico de navegação.
 */
import { emitEvent } from "@/lib/events/bus";
import {
  loadLeads,
  registerLead,
  saveVisitorIdentity,
  type LeadRecord,
} from "@/lib/leads";
import { addComment } from "@/lib/investor-comments";
import {
  attachLeadToIdentity,
  attachSessionToIdentity,
  deviceFingerprint,
  normalizeEmail,
  resolveIdentity,
} from "@/lib/portal-identity";
import { readEntryContext } from "@/lib/portal-entry";
import { getResponsibleExecutive } from "@/lib/responsible-executive";

const SESSION_KEY = "velox:portal:session:v1";

export type JourneyStatus =
  | "identificado"
  | "manual"
  | "portal"
  | "simulador"
  | "contato";

export type SessionHistoryEntry = {
  at: string;
  module: string;
  detail?: string;
};

export type PortalSession = {
  /** Identificador interno da sessão. */
  sessionId: string;
  /** Identidade permanente (independente do Lead). */
  identityId: string;
  /** Lead comercial vinculado a esta sessão. */
  investorId: string;
  name: string;
  email: string;
  responsibleExecutiveId: string | null;
  responsibleExecutiveSlug: string | null;
  unit: string | null;
  origin: string;
  campaign: string | null;
  device: string;
  personalized: boolean;
  startedAt: string;
  lastSeenAt: string;
  journeyStatus: JourneyStatus;
  history: SessionHistoryEntry[];
  restored: boolean;
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

function findLeadByEmail(email: string): LeadRecord | null {
  const normalized = normalizeEmail(email);
  return loadLeads().find((lead) => normalizeEmail(lead.email) === normalized) ?? null;
}

export function getPortalSession(): PortalSession | null {
  const session = safeRead<PortalSession>(SESSION_KEY);
  if (!session?.investorId) return null;
  return session;
}

export function hasPortalSession(): boolean {
  return Boolean(getPortalSession());
}

export function getCurrentInvestorId(): string | null {
  return getPortalSession()?.investorId ?? null;
}

export function clearPortalSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

function persist(session: PortalSession): PortalSession {
  safeWrite(SESSION_KEY, session);
  return session;
}

/** Registra navegação na sessão — usada por todos os módulos. */
export function trackSessionNavigation(module: string, detail?: string): PortalSession | null {
  const session = getPortalSession();
  if (!session) return null;
  const history = [...(session.history ?? []), { at: new Date().toISOString(), module, detail }];
  return persist({
    ...session,
    history: history.slice(-100),
    lastSeenAt: new Date().toISOString(),
  });
}

export function setJourneyStatus(status: JourneyStatus): PortalSession | null {
  const session = getPortalSession();
  if (!session) return null;
  return persist({ ...session, journeyStatus: status, lastSeenAt: new Date().toISOString() });
}

export function startPortalSession(input: {
  name: string;
  email: string;
  origin?: string;
  nextPath?: string;
}): PortalSession {
  const entry = readEntryContext();
  const responsible = getResponsibleExecutive();
  const identity = resolveIdentity({ name: input.name, email: input.email });
  const existing = findLeadByEmail(input.email);
  const lead =
    existing ??
    registerLead({
      identity: {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        whatsapp: "",
        city: "",
      },
      material: "Gateway Portal Velox",
      origin: input.origin ?? entry.origin ?? "Portal Velox",
    }).lead;

  attachLeadToIdentity(identity.id, lead.id);

  const now = new Date().toISOString();
  const session: PortalSession = {
    sessionId: `ses_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    identityId: identity.id,
    investorId: lead.id,
    name: lead.name,
    email: lead.email,
    responsibleExecutiveId: lead.responsibleExecutiveId ?? responsible.executive?.id ?? null,
    responsibleExecutiveSlug: responsible.executive?.slug ?? entry.executiveSlug ?? null,
    unit: entry.unit,
    origin: input.origin ?? entry.origin ?? "Portal Velox",
    campaign: entry.campaign,
    device: deviceFingerprint(),
    personalized: responsible.personalized || lead.personalized,
    startedAt: now,
    lastSeenAt: now,
    journeyStatus: "identificado",
    history: [{ at: now, module: "gateway", detail: "Sessão criada" }],
    restored: Boolean(existing),
  };

  attachSessionToIdentity(identity.id, session.sessionId);
  persist(session);

  saveVisitorIdentity({
    name: lead.name,
    email: lead.email,
    whatsapp: lead.whatsapp,
    city: lead.city,
  });

  emitEvent({
    type: "journey.started",
    investorId: lead.id,
    actorId: session.responsibleExecutiveId,
    payload: {
      gateway: true,
      sessionId: session.sessionId,
      identityId: identity.id,
      restored: Boolean(existing),
      origin: session.origin,
      unit: session.unit,
      campaign: session.campaign,
      nextPath: input.nextPath ?? entry.pendingModule ?? "manual",
    },
  });

  addComment({
    investorId: lead.id,
    authorId: "ai_corporate",
    authorName: "IA Corporativa",
    body: existing
      ? "Investidor recorrente identificado pelo Gateway. Perfil anterior restaurado para continuidade da jornada."
      : "Novo investidor identificado pelo Gateway. Jornada iniciada com perfil único para Manual, Material Institucional e Simulador.",
  });

  return session;
}
