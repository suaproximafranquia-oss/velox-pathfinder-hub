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
export function updateLead(id: string, patch: Partial<VisitorIdentity>): LeadRecord | null {
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