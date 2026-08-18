/**
 * Jornada Digital × Relacionamento Comercial (DEF 2.4.11).
 *
 * Um visitante que apenas navega pelo Portal NÃO gera Lead operacional,
 * Card no Workspace nem Registro Comercial: ele permanece como uma
 * "Conversa Congelada" dentro do CRM (Jornada Digital), com histórico
 * totalmente visível e envio manual bloqueado.
 *
 * O Relacionamento Comercial nasce apenas por decisão explícita:
 *  • o Executivo aciona "Iniciar Relacionamento" no CRM; ou
 *  • o investidor aciona "Solicitar Atendimento" no Portal.
 *
 * Registros sem entrada nesta base são considerados relacionamentos
 * ativos — preservando integralmente todo o comportamento homologado
 * antes desta atualização.
 */
import { logAudit } from "@/lib/audit-log";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { notifySync } from "@/lib/sync-bus";
import { loadLeads, patchCachedLead } from "@/lib/leads";
import { updateWorkspaceOperational } from "@/lib/workspace-operational.functions";

export type CommercialState = "jornada" | "ativo" | "arquivado";

export type CommercialRecord = {
  investorId: string;
  state: CommercialState;
  /** Início da Jornada Digital (nunca perdido). */
  journeyStartedAt: string;
  /** Data/hora da criação do Relacionamento Comercial. */
  startedAt?: string;
  startedBy?: string;
  startedByName?: string;
  /** Como o relacionamento nasceu. */
  source?: "executivo" | "solicitacao_investidor";
  archivedAt?: string;
  archivedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
};

type Store = Record<string, CommercialRecord>;

function read(): Store {
  return Object.fromEntries(
    loadLeads().map((lead) => [lead.id, {
      investorId: lead.id,
      state: lead.commercialState === "journey" ? "jornada" : lead.commercialState === "archived" ? "arquivado" : "ativo",
      journeyStartedAt: lead.journeyStartedAt ?? lead.createdAt,
      startedAt: lead.relationshipStartedAt ?? undefined,
      startedBy: lead.relationshipStartedBy ?? undefined,
      startedByName: lead.relationshipStartedByName ?? undefined,
      source: lead.relationshipSource === "investor_request" ? "solicitacao_investidor" : lead.relationshipSource === "executive" ? "executivo" : undefined,
      archivedAt: lead.archivedAt ?? undefined,
      archivedBy: lead.archivedBy ?? undefined,
      restoredAt: lead.restoredAt ?? undefined,
      restoredBy: lead.restoredBy ?? undefined,
    } satisfies CommercialRecord]),
  );
}

function write(store: Store) {
  for (const record of Object.values(store)) {
    const patch = {
      commercialState: record.state === "ativo" ? "active" as const : record.state === "arquivado" ? "archived" as const : "journey" as const,
      journeyStartedAt: record.journeyStartedAt,
      relationshipStartedAt: record.startedAt ?? null,
      relationshipStartedBy: record.startedBy ?? null,
      relationshipStartedByName: record.startedByName ?? null,
      relationshipSource: record.source === "executivo" ? "executive" as const : record.source === "solicitacao_investidor" ? "investor_request" as const : null,
      archivedAt: record.archivedAt ?? null,
      archivedBy: record.archivedBy ?? null,
      restoredAt: record.restoredAt ?? null,
      restoredBy: record.restoredBy ?? null,
    };
    patchCachedLead(record.investorId, patch);
    void updateWorkspaceOperational({ data: { id: record.investorId, ...patch } }).catch(() => undefined);
  }
  // Workspace, CRM, Backup e Alertas passam a refletir a mudança na hora.
  notifySync("commercial");
}

export function getCommercial(investorId: string): CommercialRecord | null {
  return read()[investorId] ?? null;
}

/** Sem registro = relacionamento já existente (base homologada). */
export function isJourneyOnly(investorId: string): boolean {
  return getCommercial(investorId)?.state === "jornada";
}

export function isArchived(investorId: string): boolean {
  return getCommercial(investorId)?.state === "arquivado";
}

export function hasCommercialRelationship(investorId: string): boolean {
  const state = getCommercial(investorId)?.state;
  return state === undefined || state === "ativo";
}

/**
 * Marca o visitante como Jornada Digital. Idempotente: jamais rebaixa um
 * relacionamento já iniciado ou arquivado.
 */
export function markJourneyOnly(investorId: string): CommercialRecord {
  const store = read();
  const existing = store[investorId];
  if (existing) return existing;
  const record: CommercialRecord = {
    investorId,
    state: "jornada",
    journeyStartedAt: new Date().toISOString(),
  };
  store[investorId] = record;
  write(store);
  return record;
}

/**
 * Cria o Relacionamento Comercial. Toda a Jornada Digital anterior é
 * integralmente preservada — nada é apagado ou recriado.
 */
export function startRelationship(input: {
  investorId: string;
  investorName: string;
  actorId: string;
  actorName: string;
  actorRole?: string;
  ownerId?: string;
  origin?: string;
  source: "executivo" | "solicitacao_investidor";
}): CommercialRecord {
  const store = read();
  const now = new Date().toISOString();
  const previous = store[input.investorId];
  const record: CommercialRecord = {
    ...(previous ?? { investorId: input.investorId, journeyStartedAt: now }),
    investorId: input.investorId,
    state: "ativo",
    startedAt: previous?.startedAt ?? now,
    startedBy: previous?.startedBy ?? input.actorId,
    startedByName: previous?.startedByName ?? input.actorName,
    source: previous?.source ?? input.source,
  };
  store[input.investorId] = record;
  write(store);

  if (!previous || previous.state !== "ativo") {
    logAudit({
      actorId: input.actorId,
      actorName: input.actorName,
      actorRole: input.actorRole ?? "Automatizado",
      module: "investidores",
      action:
        input.source === "executivo"
          ? "Relacionamento comercial iniciado manualmente"
          : "Relacionamento comercial criado por solicitação de atendimento",
      target: input.investorName,
      details: `Lead comercial, Card no Workspace e conversa liberada em ${new Date(now).toLocaleString("pt-BR")}.`,
      severity: "success",
    });
    recordCrmEvent({
      investorId: input.investorId,
      event: "relacionamento_iniciado",
      origin: input.origin ?? "Portal Velox",
      reason:
        input.source === "executivo"
          ? `Relacionamento iniciado por ${input.actorName}.`
          : "Investidor solicitou atendimento pelo Portal.",
      ownerId: input.ownerId ?? input.actorId,
      actorId: input.actorId,
    });
  }
  return record;
}

/**
 * Arquivamento do relacionamento Portal: sai do Workspace e do CRM ativo,
 * porém NADA é apagado — tudo permanece na Central de Backup.
 */
export function archiveRelationship(input: {
  investorId: string;
  investorName: string;
  actorId: string;
  actorName: string;
  actorRole?: string;
  ownerId?: string;
  origin?: string;
}): CommercialRecord {
  const store = read();
  const now = new Date().toISOString();
  const record: CommercialRecord = {
    ...(store[input.investorId] ?? {
      investorId: input.investorId,
      journeyStartedAt: now,
    }),
    investorId: input.investorId,
    state: "arquivado",
    archivedAt: now,
    archivedBy: input.actorId,
  };
  store[input.investorId] = record;
  write(store);
  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole ?? "Automatizado",
    module: "investidores",
    action: "Relacionamento arquivado no Backup Portal",
    target: input.investorName,
    details:
      "Card, conversa ativa e Lead operacional removidos. Histórico, jornada e logs preservados integralmente.",
    severity: "warning",
  });
  recordCrmEvent({
    investorId: input.investorId,
    event: "relacionamento_arquivado",
    origin: input.origin ?? "Portal Velox",
    reason: `Arquivado por ${input.actorName} — conteúdo preservado no Backup Portal.`,
    ownerId: input.ownerId ?? input.actorId,
    actorId: input.actorId,
  });
  return record;
}

/** Restauração operacional: continua exatamente do ponto arquivado. */
export function restoreRelationship(input: {
  investorId: string;
  investorName: string;
  actorId: string;
  actorName: string;
  actorRole?: string;
  ownerId?: string;
  origin?: string;
  automatic?: boolean;
}): CommercialRecord {
  const store = read();
  const now = new Date().toISOString();
  const record: CommercialRecord = {
    ...(store[input.investorId] ?? {
      investorId: input.investorId,
      journeyStartedAt: now,
    }),
    investorId: input.investorId,
    state: "ativo",
    startedAt: store[input.investorId]?.startedAt ?? now,
    restoredAt: now,
    restoredBy: input.actorId,
  };
  store[input.investorId] = record;
  write(store);
  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole ?? "Automatizado",
    module: "investidores",
    action: input.automatic
      ? "Retorno identificado — relacionamento restaurado automaticamente"
      : "Conversa restaurada a partir do Backup Portal",
    target: input.investorName,
    details:
      "CRM, Workspace, Card, histórico e conversa restaurados sem criação de novo Lead ou nova Jornada.",
    severity: "success",
  });
  recordCrmEvent({
    investorId: input.investorId,
    event: input.automatic ? "retorno_identificado" : "relacionamento_restaurado",
    origin: input.origin ?? "Portal Velox",
    reason: input.automatic
      ? "Investidor identificado no retorno ao Portal — histórico e Executivo responsável mantidos."
      : `Conversa restaurada por ${input.actorName}.`,
    ownerId: input.ownerId ?? input.actorId,
    actorId: input.actorId,
  });
  return record;
}

export function listCommercialRecords(): CommercialRecord[] {
  return Object.values(read());
}

export function archivedInvestorIds(): Set<string> {
  return new Set(
    listCommercialRecords()
      .filter((r) => r.state === "arquivado")
      .map((r) => r.investorId),
  );
}
