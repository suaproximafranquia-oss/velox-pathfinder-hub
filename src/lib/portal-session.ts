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
  updateLead,
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
import { getBrand, investorPortalPath } from "@/lib/portal-brands";
import { getResponsibleExecutive } from "@/lib/responsible-executive";
import { getPortalAdministratorId } from "@/lib/portal-workspace";
import { registerJourney, trackJourney } from "@/lib/journey/engine";
import {
  markJourneyOnly,
  isArchived,
  isJourneyOnly,
  hasCommercialRelationship,
  restoreRelationship,
  startRelationship,
} from "@/lib/crm/commercial";
import { listCrmMessages } from "@/lib/crm/messages";
import { recordCrmEvent } from "@/lib/crm/timeline";
import {
  clearDigitalJourney,
  getDigitalJourney,
  isJourneyId,
  saveDigitalJourney,
} from "@/lib/portal-journey";
import { transferVerification } from "@/lib/portal-verification";
import { resolveEntryOrigin } from "@/lib/portal/entry-origin";
import { resolveOwnership, resolveIdentityMatch } from "@/lib/portal/ownership";
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
  /** Marca/operação de origem do link público. */
  brand: string;
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
  const identity = resolveIdentity({
    name: input.name,
    email: input.email,
    phone: input.phone,
  });
  const existing = findLeadByEmail(input.email) ?? findLeadByPhone(input.phone);
  const origin = input.origin ?? entry.origin ?? "Portal Velox";

  /**
   * Regra oficial dos dois cenários de entrada:
   *
   * 1) LINK PERSONALIZADO — o relacionamento já existe antes do acesso.
   *    O Portal apenas dá continuidade à jornada do Executivo dono do
   *    link: nada de Jornada Digital, nada de mensagem institucional de
   *    boas-vindas e nada de confirmação por WhatsApp.
   * 2) ACESSO DIRETO — investidor orgânico do Portal. Nasce apenas a
   *    Jornada Digital (bloqueada) sob o Administrador híbrido, no escopo
   *    Portal, e o CRM dispara a mensagem oficial de boas-vindas.
   */
  const personalizedEntry = Boolean(responsible.personalized && responsible.executive?.id);
  const journeyBorn = !existing && !personalizedEntry;
  /**
   * Lead Orgânico pertence ao Portal e ao Administrador responsável — o
   * dono do relacionamento nunca é "sistema", para que Workspace, CRM,
   * Backup e Alertas apontem para a mesma pessoa desde o primeiro acesso.
   */
  const portalOwnerId = getPortalAdministratorId();
  const base =
    existing ??
    registerLead({
      identity: {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        whatsapp: input.phone?.trim() ?? "",
        city: "",
      },
      material: personalizedEntry
        ? "Portal do Investidor — Link personalizado"
        : "Portal do Investidor — Jornada Digital",
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

  /**
   * COMANDO 4E §47/§48 — origem e proprietário são decididos por UMA
   * ÚNICA fonte central. Nenhuma tela reimplementa a regra.
   */
  const entryExecutive = responsible.personalized ? (responsible.executive ?? null) : null;
  const originKind = resolveEntryOrigin({
    executive: entryExecutive,
    campaign: entry.campaign,
  });
  const decision = resolveOwnership({
    origin: originKind,
    entryExecutiveId: entryExecutive?.id ?? null,
    existing: existing
      ? {
          ownerId: existing.originalOwnerId ?? existing.responsibleExecutiveId ?? null,
          operationalOwnerId:
            existing.operationalOwnerId ?? existing.responsibleExecutiveId ?? null,
          scope: existing.scope ?? null,
          sharedExecutiveIds: existing.sharedExecutiveIds ?? [],
        }
      : null,
    defaultOwnerId: portalOwnerId,
    /**
     * COMANDO 3 §8 — links oficiais de canal (/origem/tiktok|meta)
     * direcionam o novo investidor para a carteira própria do canal.
     */
    channelScope:
      entry.channel === "tiktok" || entry.channel === "meta" ? entry.channel : null,
  });

  /**
   * §38 — lead redistribuído nunca volta a Green Sales: apenas o escopo
   * de leitura compartilhada é ampliado.
   */
  const keepRedistribution = (base.scope ?? null) === "redistribuicao";
  const lead =
    updateLead(base.id, {
      scope: keepRedistribution ? "redistribuicao" : decision.scope,
      responsibleExecutiveId: keepRedistribution
        ? (base.responsibleExecutiveId ?? decision.operationalOwnerId)
        : decision.operationalOwnerId,
      operationalOwnerId: keepRedistribution
        ? (base.operationalOwnerId ?? base.responsibleExecutiveId ?? null)
        : decision.operationalOwnerId,
      originalOwnerId: keepRedistribution
        ? (base.originalOwnerId ?? decision.ownerId)
        : decision.ownerId,
      sharedExecutiveIds: decision.sharedExecutiveIds,
      personalized: decision.personalized,
    }) ??
    applyLeadRouting(base.id, {
      personalized: responsible.personalized,
      responsibleExecutiveId: entryExecutive?.id ?? null,
    }) ??
    base;

  /**
   * §22 — conflito de identidade (e-mail de uma pessoa, telefone de
   * outra) nunca faz merge automático: fica marcado para revisão.
   */
  const emailMatch = findLeadByEmail(input.email);
  const phoneMatch = findLeadByPhone(input.phone);
  const identityResolution = resolveIdentityMatch({
    byEmail: emailMatch?.id ?? null,
    byPhone: phoneMatch?.id ?? null,
  });
  if (identityResolution.kind === "conflict") {
    updateLead(lead.id, {
      identityConflict: {
        note: identityResolution.note,
        withInvestorId:
          identityResolution.emailInvestorId === lead.id
            ? identityResolution.phoneInvestorId
            : identityResolution.emailInvestorId,
        at: new Date().toISOString(),
      },
    });
  }

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
    brand: getBrand(entry.brand).key,
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
    link: session.responsibleExecutiveSlug
      ? investorPortalPath(session.responsibleExecutiveSlug, session.brand)
      : null,
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

  // SEPARAÇÃO DE CONTEXTOS: iniciar a jornada é um evento do PORTAL DO
  // INVESTIDOR. Nenhuma mensagem do Portal é injetada na conversa do CRM
  // de Relacionamento — o CRM registra apenas o EVENTO no histórico.
  if (!journeyBorn && listCrmMessages(lead.id).length === 0) {
    recordCrmEvent({
      investorId: lead.id,
      event: "atividade_portal",
      origin: input.origin ?? entry.origin ?? "Portal Velox",
      reason: existing
        ? "Investidor retomou a Jornada Digital no Portal do Investidor."
        : "Jornada Digital iniciada pelo investidor no Portal do Investidor.",
      ownerId: lead.responsibleExecutiveId ?? portalOwnerId,
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
      action: "Jornada Digital criada — investidor identificado no Gateway",
      target: lead.name,
      details: `Origem: ${origin}. Identificação cadastral concluída — nenhuma mensagem foi enviada.`,
      severity: "info",
    });
    recordCrmEvent({
      investorId: lead.id,
      event: "atividade_portal",
      origin,
      reason:
        "Jornada Digital iniciada no Gateway — investidor identificado pelo cadastro.",
      ownerId: lead.responsibleExecutiveId ?? portalOwnerId,
      actorId: "sistema",
    });
    // COMANDO 4E §24/§45 — nenhum template, nenhuma chamada à Meta e
    // nenhuma validação real: a identificação cadastral é suficiente.
    notifySync("leads");
    notifySync("commercial");
    notifySync("timeline");
    notifySync("audit");
  }

  /**
   * Cenário 1 — link personalizado: o relacionamento comercial já
   * pertence ao Executivo que enviou o link. Ele é garantido aqui (sem
   * template institucional e sem validação de WhatsApp), preservando o
   * escopo Green Sales.
   */
  if (personalizedEntry && !hasCommercialRelationship(lead.id)) {
    startRelationship({
      investorId: lead.id,
      investorName: lead.name,
      actorId: lead.responsibleExecutiveId ?? "sistema",
      actorName: responsible.executive?.name ?? "Executivo responsável",
      actorRole: "Executivo",
      ownerId: lead.responsibleExecutiveId ?? "sistema",
      origin,
      source: "executivo",
    });
    notifySync("leads");
    notifySync("commercial");
    notifySync("timeline");
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
    link: session.responsibleExecutiveSlug
      ? investorPortalPath(session.responsibleExecutiveSlug, session.brand)
      : null,
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

  recordCrmEvent({
    investorId: routed.id,
    event: "atividade_portal",
    origin,
    reason: "Investidor identificado no Portal — relacionamento comercial criado automaticamente.",
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
      identified: true,
    },
  });

  addComment({
    investorId: routed.id,
    authorId: "ai_corporate",
    authorName: "IA Corporativa",
    body: "Investidor identificado pelo cadastro. Relacionamento comercial criado com Card, conversa e Executivo responsável registrados.",
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
