import { emitEvent } from "@/lib/events/bus";
import {
  loadLeads,
  registerLead,
  saveVisitorIdentity,
  type LeadRecord,
} from "@/lib/leads";
import { addComment } from "@/lib/investor-comments";

const SESSION_KEY = "velox:portal:session:v1";

export type PortalSession = {
  investorId: string;
  name: string;
  email: string;
  responsibleExecutiveId: string | null;
  personalized: boolean;
  startedAt: string;
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function findLeadByEmail(email: string): LeadRecord | null {
  const normalized = normalizeEmail(email);
  return loadLeads().find((lead) => normalizeEmail(lead.email) === normalized) ?? null;
}

function persistSession(lead: LeadRecord, restored: boolean): PortalSession {
  const session: PortalSession = {
    investorId: lead.id,
    name: lead.name,
    email: lead.email,
    responsibleExecutiveId: lead.responsibleExecutiveId,
    personalized: lead.personalized,
    startedAt: new Date().toISOString(),
    restored,
  };
  safeWrite(SESSION_KEY, session);
  saveVisitorIdentity({
    name: lead.name,
    email: lead.email,
    whatsapp: lead.whatsapp,
    city: lead.city,
  });
  return session;
}

export function getPortalSession(): PortalSession | null {
  return safeRead<PortalSession>(SESSION_KEY);
}

export function hasPortalSession(): boolean {
  return Boolean(getPortalSession()?.investorId);
}

export function getCurrentInvestorId(): string | null {
  return getPortalSession()?.investorId ?? null;
}

export function clearPortalSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function startPortalSession(input: {
  name: string;
  email: string;
  origin?: string;
  nextPath?: string;
}): PortalSession {
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
      origin: input.origin ?? "Portal Velox",
    }).lead;

  const session = persistSession(lead, Boolean(existing));

  emitEvent({
    type: "journey.started",
    investorId: lead.id,
    actorId: lead.responsibleExecutiveId,
    payload: {
      gateway: true,
      restored: Boolean(existing),
      origin: input.origin ?? "Portal Velox",
      nextPath: input.nextPath ?? "/manual",
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