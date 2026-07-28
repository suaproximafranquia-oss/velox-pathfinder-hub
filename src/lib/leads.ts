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
  const lead: LeadRecord = {
    id: `ld_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ...input.identity,
    origin,
    material: input.material,
    createdAt: new Date().toISOString(),
    responsibleExecutiveId: responsible.executive?.id ?? null,
    personalized: responsible.personalized,
  };
  const all = loadLeads();
  all.push(lead);
  safeWrite(LEADS_KEY, all);
  saveVisitorIdentity(input.identity);
  return { lead, executive: responsible.executive, personalized: responsible.personalized };
}