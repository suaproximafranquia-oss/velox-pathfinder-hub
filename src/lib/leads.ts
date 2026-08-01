/**
 * Registro de Leads — persistência local unificada.
 *
 * Todo material do Portal (Manual, Material Institucional, futuros
 * módulos) usa este utilitário antes de abrir o WhatsApp, garantindo
 * que o lead permaneça registrado mesmo que o visitante feche a
 * conversa no meio.
 *
 * NÃO altera a lógica de atribuição do executivo responsável — apenas
 * consome `getResponsibleExecutive()` para saber a quem vincular o lead.
 */
import { getResponsibleExecutive } from "@/lib/responsible-executive";
import type { ExecutiveUser } from "@/lib/executive-auth";
import { notifySync } from "@/lib/sync-bus";

const LEADS_KEY = "velox:leads:v1";
const IDENTITY_KEY = "velox:visitor:identity:v1";

export type VisitorIdentity = {
  name: string;
  whatsapp: string;
  email: string;
  city: string;
};

export type LeadRecord = VisitorIdentity & {
  id: string;
  origin: string;
  material: string;
  createdAt: string;
  responsibleExecutiveId: string | null;
  personalized: boolean;
  /** Observações operacionais do Executivo (ficha do Workspace). */
  notes?: string;
  /**
   * Escopo permanente do Lead no Workspace ("green_sales" quando veio de
   * link personalizado; "portal" quando veio do acesso institucional).
   */
  scope?: "green_sales" | "portal";
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
  if (key === LEADS_KEY) notifySync("leads");
}

export function getVisitorIdentity(): VisitorIdentity | null {
  return safeRead<VisitorIdentity>(IDENTITY_KEY);
}

export function saveVisitorIdentity(identity: VisitorIdentity) {
  safeWrite(IDENTITY_KEY, identity);
}

export function loadLeads(): LeadRecord[] {
  return safeRead<LeadRecord[]>(LEADS_KEY) ?? [];
}

/**
 * Substitui integralmente a base local — usada pelo espelho da base real
 * (Lovable Cloud) no Workspace do Executivo.
 */
export function replaceLeads(leads: LeadRecord[]): void {
  safeWrite(LEADS_KEY, leads);
}

/**
 * Sincronização com o servidor sem criar dependência circular
 * (`portal-leads-sync` importa este módulo).
 */
function syncToCloud(lead: LeadRecord) {
  if (typeof window === "undefined") return;
  void import("@/lib/portal-leads-sync")
    .then((m) => m.pushLead(lead))
    .catch(() => {});
}

/**
 * Restaura (quando arquivado) o relacionamento existente e registra o
 * evento em Timeline e Auditoria. Importação dinâmica para evitar
 * dependência circular com o CRM.
 */
function restoreExistingRelationship(lead: LeadRecord) {
  if (typeof window === "undefined") return;
  syncToCloud(lead);
  void import("@/lib/crm/commercial")
    .then((m) => {
      if (!m.isArchived(lead.id)) return;
      m.restoreRelationship({
        investorId: lead.id,
        investorName: lead.name,
        actorId: "system",
        actorName: "Sistema",
        ownerId: lead.responsibleExecutiveId ?? undefined,
        origin: lead.scope === "green_sales" ? "Green Sales" : "Portal Velox",
        automatic: true,
      });
    })
    .catch(() => {});
  void import("@/lib/crm/timeline")
    .then((m) =>
      m.recordCrmEvent({
        investorId: lead.id,
        event: "duplicidade_detectada",
        origin: lead.scope === "green_sales" ? "Green Sales" : "Portal Velox",
        reason:
          "Relacionamento anterior identificado por WhatsApp/e-mail — nenhum Card novo foi criado.",
        ownerId: lead.responsibleExecutiveId ?? "system",
        actorId: "system",
      }),
    )
    .catch(() => {});
  void import("@/lib/audit-log")
    .then((m) =>
      m.logSystemAudit("investidores", "Duplicidade evitada na criação de Lead", {
        target: lead.name,
        details:
          "Relacionamento existente restaurado — histórico, Executivo e origem preservados.",
        severity: "warning",
      }),
    )
    .catch(() => {});
}

/**
 * Reaplica o roteamento obrigatório a um Lead já existente. Um investidor
 * recorrente que retorna por link personalizado passa a pertencer ao
 * Green Sales daquele executivo; sem link continua no Portal.
 */
export function applyLeadRouting(
  id: string,
  input: { personalized: boolean; responsibleExecutiveId: string | null },
): LeadRecord | null {
  const all = loadLeads();
  const idx = all.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  const personalized = input.personalized && Boolean(input.responsibleExecutiveId);
  // O vínculo, uma vez estabelecido, é permanente: nunca rebaixa para Portal.
  if (!personalized && all[idx].scope === "green_sales") {
    syncToCloud(all[idx]);
    return all[idx];
  }
  const merged: LeadRecord = {
    ...all[idx],
    personalized,
    responsibleExecutiveId: personalized ? input.responsibleExecutiveId : null,
    scope: personalized ? "green_sales" : "portal",
  };
  all[idx] = merged;
  safeWrite(LEADS_KEY, all);
  syncToCloud(merged);
  return merged;
}

/**
 * Remove um lead da base local pelo seu id. Não afeta a base de eventos
 * (a Timeline pode manter o histórico anônimo se desejado).
 */
export function deleteLead(id: string): void {
  const all = loadLeads().filter((l) => l.id !== id);
  safeWrite(LEADS_KEY, all);
}

/**
 * Atualiza campos específicos de um lead existente (ex.: WhatsApp após
 * conclusão do Manual). Mantém a mesma identidade — nunca cria outro
 * registro.
 */
export function updateLead(
  id: string,
  patch: Partial<VisitorIdentity> &
    Partial<Pick<LeadRecord, "notes" | "scope" | "responsibleExecutiveId" | "personalized">>,
): LeadRecord | null {
  const all = loadLeads();
  const idx = all.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  const merged: LeadRecord = { ...all[idx], ...patch };
  all[idx] = merged;
  safeWrite(LEADS_KEY, all);
  syncToCloud(merged);
  saveVisitorIdentity({
    name: merged.name,
    email: merged.email,
    whatsapp: merged.whatsapp,
    city: merged.city,
  });
  return merged;
}

/** Normalização oficial usada na verificação de duplicidade (DEF 2.5.3 §9). */
export function leadPhoneKey(phone: string): string {
  const digits = (phone ?? "").replace(/\D+/g, "");
  return digits.length > 11 ? digits.slice(-11) : digits;
}

export function leadEmailKey(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Localiza um relacionamento anterior por WhatsApp ou e-mail — inclusive
 * arquivado. Nenhum Card novo pode ser criado quando existe histórico.
 */
export function findExistingLead(identity: {
  whatsapp?: string;
  email?: string;
}): LeadRecord | null {
  const phone = leadPhoneKey(identity.whatsapp ?? "");
  const email = leadEmailKey(identity.email ?? "");
  if (!phone && !email) return null;
  return (
    loadLeads().find(
      (l) =>
        (phone && leadPhoneKey(l.whatsapp) === phone) ||
        (email && leadEmailKey(l.email) === email),
    ) ?? null
  );
}

/**
 * Grava um novo lead na base local. Retorna o executivo responsável
 * resolvido pela lógica oficial (link personalizado ou padrão).
 */
export function registerLead(input: {
  identity: VisitorIdentity;
  material: string;
  origin?: string;
}): { lead: LeadRecord; executive: ExecutiveUser | null; personalized: boolean } {
  const responsible = getResponsibleExecutive();
  const origin =
    input.origin ??
    (typeof window !== "undefined" ? window.location.pathname : "direct");
  // DEF 2.5.3 §9 — duplicidade: existindo relacionamento anterior
  // (WhatsApp ou e-mail), NUNCA cria novo Card; restaura o existente.
  const existing = findExistingLead(input.identity);
  if (existing) {
    const restored = updateLead(existing.id, input.identity) ?? existing;
    restoreExistingRelationship(restored);
    return {
      lead: restored,
      executive: responsible.executive,
      personalized: restored.scope === "green_sales",
    };
  }
  // Vínculo individual existe SOMENTE em link personalizado. Acesso
  // institucional gera Lead do Portal, sem dono.
  const responsibleExecutiveId = responsible.personalized
    ? (responsible.executive?.id ?? null)
    : null;
  const lead: LeadRecord = {
    id: `ld_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ...input.identity,
    origin,
    material: input.material,
    createdAt: new Date().toISOString(),
    responsibleExecutiveId,
    personalized: responsible.personalized,
    scope: responsible.personalized && responsibleExecutiveId ? "green_sales" : "portal",
  };
  const all = loadLeads();
  all.push(lead);
  safeWrite(LEADS_KEY, all);
  saveVisitorIdentity(input.identity);
  // Criação IMEDIATA do Card no Workspace: o Lead é enviado ao servidor no
  // mesmo instante da identificação, sem aguardar qualquer outra ação.
  syncToCloud(lead);
  return { lead, executive: responsible.executive, personalized: responsible.personalized };
}