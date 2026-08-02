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
  isJourneyOnly,
  restoreRelationship,
  startRelationship,
} from "@/lib/crm/commercial";
import { appendCrmMessage, listCrmMessages } from "@/lib/crm/messages";
import { recordCrmEvent } from "@/lib/crm/timeline";
import {
  clearDigitalJourney,
  getDigitalJourney,
  isJourneyId,
  saveDigitalJourney,
} from "@/lib/portal-journey";
import {
  requestWhatsappConfirmation,
  transferVerification,
} from "@/lib/portal-verification";
import { logAudit } from "@/lib/audit-log";
import { notifySync } from "@/lib/sync-bus";

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
  const origin = input.origin ?? entry.origin ?? "Portal Velox";

  /**
   * DEF 3.0.2 §1 — o visitante inédito NÃO vira Lead Comercial. Nasce
   * apenas a Jornada Digital: um registro operacional conhecido pelo CRM
   * (conversa, timeline, auditoria e backup) que permanece fora do
   * Workspace e com o atendimento bloqueado até a confirmação do
   * WhatsApp.
   */
  const journeyBorn = !existing;
  const base =
    existing ??
    registerLead({
      identity: {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        whatsapp: input.phone?.trim() ?? "",
        city: "",
      },
      material: "Portal do Investidor — Jornada Digital",
      origin,
    }).lead;

  if (journeyBorn) {
    // Estado oficial: Jornada Digital aguardando validação.
    markJourneyOnly(base.id);
    saveDigitalJourney({
      journeyId: base.id,
      name: base.name,
      email: base.email,
      phone: input.phone?.trim() ?? "",
      executiveSlug: responsible.personalized
        ? (responsible.executive?.slug ?? entry.executiveSlug ?? null)
        : null,
      unit: entry.unit,
      origin,
      campaign: entry.campaign,
      startedAt: new Date().toISOString(),
    });
  }

  // Roteamento obrigatório também para investidor recorrente: quem volta
  // por link personalizado é reconduzido ao Green Sales do executivo.
  const lead =
    applyLeadRouting(base.id, {
      personalized: responsible.personalized,
      responsibleExecutiveId: responsible.personalized
        ? (responsible.executive?.id ?? null)
        : null,
    }) ?? base;

  attachLeadToIdentity(identity.id, lead.id);

  /**
   * DEF 2.4.11 — Jornada Digital.
   *
   * O visitante identificado NÃO gera Lead operacional, Card no Workspace
   * nem Registro Comercial: ele existe apenas como conversa congelada no
   * CRM. Investidor recorrente arquivado é restaurado automaticamente,
   * mantendo Executivo responsável, histórico e jornada.
   */
  if (isArchived(lead.id)) {
    restoreRelationship({
      investorId: lead.id,
      investorName: lead.name,
      actorId: "sistema",
      actorName: "Sistema",
      actorRole: "Automatizado",
      ownerId: lead.responsibleExecutiveId ?? "sistema",
      origin,
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

  /**
   * DEF 3.0.2 §2 e §3 — assim que a Jornada Digital nasce, o CRM registra
   * o relacionamento em validação (conversa, timeline, auditoria e
   * backup) e dispara automaticamente o Template Oficial da Meta.
   */
  if (journeyBorn) {
    logAudit({
      actorId: "sistema",
      actorName: "Portal Velox",
      actorRole: "Automatizado",
      module: "investidores",
      action: "Jornada Digital criada — aguardando confirmação do WhatsApp",
      target: lead.name,
      details: `Origem: ${origin}. Nenhum Lead Comercial foi criado: o relacionamento permanece bloqueado até a resposta oficial do investidor.`,
      severity: "info",
    });
    recordCrmEvent({
      investorId: lead.id,
      event: "atividade_portal",
      origin,
      reason:
        "Jornada Digital iniciada no Gateway — status: aguardando confirmação do WhatsApp.",
      ownerId: lead.responsibleExecutiveId ?? "sistema",
      actorId: "sistema",
    });
    requestWhatsappConfirmation({
      investorId: lead.id,
      investorName: lead.name,
      phone: lead.whatsapp || (input.phone ?? ""),
      origin,
      ownerId: lead.responsibleExecutiveId ?? null,
      personalized: Boolean(session.personalized && lead.responsibleExecutiveId),
    });
    notifySync("leads");
    notifySync("commercial");
    notifySync("timeline");
    notifySync("audit");
  }

  return session;
}

/**
 * DEF 2.5.1 §09 — promoção da Jornada Digital a Relacionamento Comercial.
 *
 * Executada EXCLUSIVAMENTE após a confirmação do WhatsApp. Só neste
 * momento nascem Lead, Card no Workspace, Conversa no CRM, Timeline,
 * Auditoria, Executivo responsável, Origem, Data e Hora.
 */
export function promotePortalSession(): PortalSession | null {
  const session = getPortalSession();
  if (!session) return null;
  /**
   * DEF 3.0.2 §4 — o registro já existe desde o Gateway como Jornada
   * Digital. Confirmar o WhatsApp NÃO cria outro cadastro: converte o
   * mesmo registro em Relacionamento Comercial.
   */
  if (!isJourneyOnly(session.investorId) && !isJourneyId(session.investorId)) return session;

  const journey = getDigitalJourney();
  const email = journey?.email ?? session.email;
  const phone = journey?.phone ?? "";
  const origin = journey?.origin ?? session.origin;
  const responsible = getResponsibleExecutive();

  const existing =
    loadLeads().find((l) => l.id === session.investorId) ??
    findLeadByEmail(email) ??
    findLeadByPhone(phone);
  if (!existing) return session;
  const lead = existing;

  const routed =
    applyLeadRouting(lead.id, {
      personalized: responsible.personalized,
      responsibleExecutiveId: responsible.personalized
        ? (responsible.executive?.id ?? null)
        : null,
    }) ?? lead;

  attachLeadToIdentity(session.identityId, routed.id);

  // Mesmo registro, agora promovido a relacionamento comercial ativo.
  startRelationship({
    investorId: routed.id,
    investorName: routed.name,
    actorId: "sistema",
    actorName: "Sistema",
    actorRole: "Automatizado",
    ownerId: routed.responsibleExecutiveId ?? "sistema",
    origin,
    source: "solicitacao_investidor",
  });

  registerJourney({
    investorId: routed.id,
    identityId: session.identityId,
    name: routed.name,
    email: routed.email,
    phone: routed.whatsapp || null,
    executiveId: routed.responsibleExecutiveId ?? session.responsibleExecutiveId,
    executiveSlug: session.responsibleExecutiveSlug,
    unit: session.unit,
    origin,
    campaign: session.campaign,
    link: session.responsibleExecutiveSlug ? `/e/${session.responsibleExecutiveSlug}` : null,
    personalized: session.personalized,
    device: session.device,
    restored: Boolean(existing),
  });

  saveVisitorIdentity({
    name: routed.name,
    email: routed.email,
    whatsapp: routed.whatsapp,
    city: routed.city,
  });

  if (listCrmMessages(routed.id).length === 0) {
    appendCrmMessage({
      investorId: routed.id,
      direction: "enviada",
      body: `Olá, ${routed.name}. Seja bem-vindo ao Portal Velox. Sua identidade foi confirmada e sua jornada ficará salva.`,
      authorId: "sistema",
    });
  }
  recordCrmEvent({
    investorId: routed.id,
    event: "atividade_portal",
    origin,
    reason: "WhatsApp confirmado no Portal — relacionamento comercial criado automaticamente.",
    ownerId: routed.responsibleExecutiveId ?? "sistema",
    actorId: "sistema",
  });

  emitEvent({
    type: "journey.started",
    investorId: routed.id,
    actorId: routed.responsibleExecutiveId,
    payload: {
      gateway: true,
      sessionId: session.sessionId,
      identityId: session.identityId,
      restored: Boolean(existing),
      origin,
      unit: session.unit,
      campaign: session.campaign,
      whatsappConfirmed: true,
    },
  });

  addComment({
    investorId: routed.id,
    authorId: "ai_corporate",
    authorName: "IA Corporativa",
    body: "WhatsApp confirmado pelo visitante. Relacionamento comercial criado com Card, conversa e Executivo responsável registrados.",
  });

  transferVerification(session.investorId, routed.id);
  clearDigitalJourney();

  return persist({
    ...session,
    investorId: routed.id,
    name: routed.name,
    email: routed.email,
    responsibleExecutiveId: routed.responsibleExecutiveId ?? session.responsibleExecutiveId,
    lastSeenAt: new Date().toISOString(),
  });
}
