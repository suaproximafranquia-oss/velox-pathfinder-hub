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
  applyLeadRouting,
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
import { registerJourney, trackJourney } from "@/lib/journey/engine";
import {
  markJourneyOnly,
  isArchived,
  restoreRelationship,
} from "@/lib/crm/commercial";
import { appendCrmMessage, listCrmMessages } from "@/lib/crm/messages";
import { recordCrmEvent } from "@/lib/crm/timeline";

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

function digits(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Identificação de retorno (DEF 2.4.11): o mesmo WhatsApp jamais gera um
 * novo cadastro — o histórico existente é sempre reaproveitado.
 */
function findLeadByPhone(phone?: string | null): LeadRecord | null {
  const normalized = digits(phone);
  if (normalized.length < 10) return null;
  return loadLeads().find((lead) => digits(lead.whatsapp) === normalized) ?? null;
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
  trackJourney({
    investorId: session.investorId,
    type: "journey.module.opened",
    detail: detail ?? module,
  });
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

/**
 * Continuidade da jornada: último módulo consumido pelo investidor.
 * Permite retomar exatamente de onde parou ao voltar ao Portal.
 */
export function getResumePoint(): { module: string; detail?: string; at: string } | null {
  const session = getPortalSession();
  if (!session) return null;
  const last = [...(session.history ?? [])]
    .reverse()
    .find((entry) => entry.module !== "gateway");
  return last ? { module: last.module, detail: last.detail, at: last.at } : null;
}

export function startPortalSession(input: {
  name: string;
  email: string;
  phone?: string;
  origin?: string;
  nextPath?: string;
}): PortalSession {
  const entry = readEntryContext();
  const responsible = getResponsibleExecutive();
  const identity = resolveIdentity({ name: input.name, email: input.email });
  const existing = findLeadByEmail(input.email) ?? findLeadByPhone(input.phone);
  const baseLead =
    existing ??
    registerLead({
      identity: {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        whatsapp: input.phone?.trim() ?? "",
        city: "",
      },
      material: "Gateway Portal Velox",
      origin: input.origin ?? entry.origin ?? "Portal Velox",
    }).lead;

  // Roteamento obrigatório também para investidor recorrente: quem volta
  // por link personalizado é reconduzido ao Green Sales do executivo.
  const lead = existing
    ? (applyLeadRouting(existing.id, {
        personalized: responsible.personalized,
        responsibleExecutiveId: responsible.personalized
          ? (responsible.executive?.id ?? null)
          : null,
      }) ?? existing)
    : baseLead;

  attachLeadToIdentity(identity.id, lead.id);

  /**
   * DEF 2.4.11 — Jornada Digital.
   *
   * O visitante identificado NÃO gera Lead operacional, Card no Workspace
   * nem Registro Comercial: ele existe apenas como conversa congelada no
   * CRM. Investidor recorrente arquivado é restaurado automaticamente,
   * mantendo Executivo responsável, histórico e jornada.
   */
  if (!existing) {
    markJourneyOnly(lead.id);
  } else if (isArchived(lead.id)) {
    restoreRelationship({
      investorId: lead.id,
      investorName: lead.name,
      actorId: "sistema",
      actorName: "Sistema",
      actorRole: "Automatizado",
      ownerId: lead.responsibleExecutiveId ?? "sistema",
      origin: input.origin ?? entry.origin ?? "Portal Velox",
      automatic: true,
    });
  }

  const now = new Date().toISOString();
  const session: PortalSession = {
    sessionId: `ses_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    identityId: identity.id,
    investorId: lead.id,
    name: lead.name,
    email: lead.email,
    // Vínculo individual apenas quando houve link personalizado.
    responsibleExecutiveId:
      lead.responsibleExecutiveId ??
      (responsible.personalized ? (responsible.executive?.id ?? null) : null),
    responsibleExecutiveSlug: responsible.personalized
      ? (responsible.executive?.slug ?? entry.executiveSlug ?? null)
      : null,
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

  /**
   * Correção obrigatória (Épico 7A): todo investidor identificado passa a
   * existir IMEDIATAMENTE no Green Sales — sem aguardar WhatsApp,
   * Simulador ou conclusão do Manual. O Journey Engine registra o Lead e
   * abre a sessão inteligente no mesmo instante.
   */
  registerJourney({
    investorId: lead.id,
    identityId: identity.id,
    name: lead.name,
    email: lead.email,
    phone: lead.whatsapp || null,
    executiveId: session.responsibleExecutiveId,
    executiveSlug: session.responsibleExecutiveSlug,
    unit: session.unit,
    origin: session.origin,
    campaign: session.campaign,
    link: session.responsibleExecutiveSlug ? `/e/${session.responsibleExecutiveSlug}` : null,
    personalized: session.personalized,
    device: session.device,
    restored: Boolean(existing),
  });

  saveVisitorIdentity({
    name: lead.name,
    email: lead.email,
    whatsapp: lead.whatsapp,
    city: lead.city,
  });

  // Template automático do sistema — única mensagem possível durante a
  // Jornada Digital. Registrado uma única vez por relacionamento.
  if (listCrmMessages(lead.id).length === 0) {
    appendCrmMessage({
      investorId: lead.id,
      direction: "enviada",
      body: existing
        ? `Olá, ${lead.name}. Que bom ver você novamente. Seu progresso foi restaurado.`
        : `Olá, ${lead.name}. Seja bem-vindo ao Portal Velox. Sua jornada foi iniciada e seu progresso ficará salvo.`,
      authorId: "sistema",
    });
    recordCrmEvent({
      investorId: lead.id,
      event: "template_automatico",
      origin: input.origin ?? entry.origin ?? "Portal Velox",
      reason: "Mensagem automática de boas-vindas enviada pelo sistema.",
      ownerId: lead.responsibleExecutiveId ?? "sistema",
      actorId: "sistema",
    });
  }

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
