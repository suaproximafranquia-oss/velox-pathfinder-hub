/**
 * CRM de Relacionamento — criação direta de Leads (DF 2.4.5).
 *
 * O CRM nunca pode depender de integração externa: o Executivo cria o
 * relacionamento pelo Importador Inteligente (print) ou pelo Cadastro
 * Manual. Em ambos os casos nascem, no mesmo instante:
 *   • o Lead na base oficial (Card do Workspace, com sincronização Cloud);
 *   • o vínculo oficial de responsabilidade no CRM (conversa + ficha);
 *   • o registro interno na Timeline.
 *
 * Leads criados aqui são PARTICULARES do executivo: não entram na fila
 * de intake nem participam de redistribuição automática.
 */
import { loadLeads, replaceLeads, type LeadRecord } from "@/lib/leads";
import { pushLead } from "@/lib/portal-leads-sync";
import {
  claimOwnership,
  reassignOwnership,
  phoneKeyOf,
  emailKeyOf,
} from "@/lib/crm/ownership";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { isArchived, restoreRelationship } from "@/lib/crm/commercial";

const PRIVATE_KEY = "crm.private-leads.v1";

function readPrivate(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRIVATE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function markPrivate(id: string) {
  if (typeof window === "undefined") return;
  const all = readPrivate();
  if (all.includes(id)) return;
  try {
    window.localStorage.setItem(PRIVATE_KEY, JSON.stringify([...all, id]));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Leads particulares nunca são redistribuídos automaticamente. */
export function isPrivateLead(id: string): boolean {
  return readPrivate().includes(id);
}

export type CrmLeadInput = {
  name: string;
  whatsapp: string;
  email: string;
  city: string;
};

export type CrmLeadSource = "importador" | "manual";

const SOURCE_LABEL: Record<CrmLeadSource, string> = {
  importador: "Importador Inteligente",
  manual: "Cadastro manual no CRM",
};

/** Campo ausente jamais impede a criação — é preenchido com "—". */
function orDash(value: string | undefined): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : "—";
}

/**
 * Identificação obrigatória antes de qualquer criação (DEF 2.4.13):
 * WhatsApp e e-mail são comparados com a base oficial. Havendo histórico,
 * a restauração sempre prevalece sobre a duplicação.
 */
function findExistingLead(fields: CrmLeadInput): LeadRecord | null {
  const phone = phoneKeyOf(fields.whatsapp);
  const email = emailKeyOf(fields.email);
  if (phone.length < 8 && email.length < 4) return null;
  return (
    loadLeads().find((l) => {
      const samePhone = phone.length >= 8 && phoneKeyOf(l.whatsapp) === phone;
      const sameEmail = email.length > 3 && emailKeyOf(l.email) === email;
      return samePhone || sameEmail;
    }) ?? null
  );
}

export function createCrmLead(input: {
  fields: CrmLeadInput;
  source: CrmLeadSource;
  /** Executivo que realizou o cadastro — proprietário automático. */
  ownerId: string;
}): LeadRecord & { duplicated?: boolean } {
  const now = new Date().toISOString();

  // Nunca duplicar: o relacionamento existente é reaproveitado e, quando
  // arquivado, retorna exatamente do ponto em que parou.
  const existing = findExistingLead(input.fields);
  if (existing) {
    if (isArchived(existing.id)) {
      restoreRelationship({
        investorId: existing.id,
        investorName: existing.name,
        actorId: input.ownerId,
        actorName: "Executivo responsável",
        ownerId: existing.responsibleExecutiveId ?? input.ownerId,
        origin: SOURCE_LABEL[input.source],
      });
    }
    recordCrmEvent({
      investorId: existing.id,
      event: "duplicidade_detectada",
      origin: SOURCE_LABEL[input.source],
      reason:
        "Cadastro interrompido: já existe relacionamento com este WhatsApp/e-mail. Histórico e Executivo responsável mantidos.",
      ownerId: existing.responsibleExecutiveId ?? input.ownerId,
      actorId: input.ownerId,
    });
    return { ...existing, duplicated: true };
  }

  // Cadastro manual dentro do CRM: o proprietário é o Executivo que
  // cadastrou, mas a carteira oficial do registro é "Redistribuição".
  const manual = input.source === "manual";
  const lead: LeadRecord = {
    id: `ld_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: orDash(input.fields.name),
    whatsapp: orDash(input.fields.whatsapp),
    email: orDash(input.fields.email),
    city: orDash(input.fields.city),
    origin: SOURCE_LABEL[input.source],
    material: SOURCE_LABEL[input.source],
    createdAt: now,
    responsibleExecutiveId: input.ownerId,
    personalized: !manual,
    scope: manual ? "redistribuicao" : "green_sales",
  };

  replaceLeads([...loadLeads(), lead]);
  // Card imediato no Workspace do Executivo (base real).
  pushLead(lead, { lastActivityAt: now });
  // A carteira "Redistribuição" precisa valer também na base oficial —
  // a sincronização do Portal, sozinha, rebaixaria o registro.
  if (manual && typeof window !== "undefined") {
    void import("@/lib/portal-leads.functions")
      .then((m) =>
        m.redistributePortalLead({ data: { id: lead.id, executiveId: input.ownerId } }),
      )
      .catch(() => undefined);
  }

  // Vínculo oficial: pertence a quem cadastrou.
  claimOwnership({
    investorId: lead.id,
    ownerId: input.ownerId,
    phone: lead.whatsapp,
    email: lead.email,
    origin: SOURCE_LABEL[input.source],
  });
  markPrivate(lead.id);

  recordCrmEvent({
    investorId: lead.id,
    event: "lead_criado",
    origin: SOURCE_LABEL[input.source],
    reason: `Lead criado via ${SOURCE_LABEL[input.source]} — relacionamento particular do Executivo.`,
    ownerId: input.ownerId,
    actorId: input.ownerId,
  });

  return lead;
}

/**
 * Redistribuição manual pela Gestora: define o novo Executivo responsável.
 * A partir deste momento o Lead pertence integralmente a ele.
 */
export function redistributeLead(input: {
  investorId: string;
  newOwnerId: string;
  actorId: string;
  origin: string;
}): void {
  reassignOwnership(input.investorId, input.newOwnerId, input.origin);
  recordCrmEvent({
    investorId: input.investorId,
    event: "lead_redistribuido",
    origin: input.origin,
    reason: "Lead redistribuído manualmente pela Gestora.",
    ownerId: input.newOwnerId,
    actorId: input.actorId,
  });
}
