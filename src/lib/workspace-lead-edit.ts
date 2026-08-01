/**
 * DEF 2.5.3 §5/§6 — edição da Ficha do Investidor no Workspace.
 *
 * Toda alteração grava na base ÚNICA de Leads e é propagada
 * imediatamente para CRM, Timeline, Auditoria, Backup e Central de
 * Alertas — sem recarregar a página e sem atualização manual.
 */
import { loadLeads, updateLead, type LeadRecord } from "@/lib/leads";
import { logAudit } from "@/lib/audit-log";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { notifySync } from "@/lib/sync-bus";
import { emitEvent } from "@/lib/events/bus";

export type LeadFicha = {
  name: string;
  email: string;
  whatsapp: string;
  city: string;
  scope: "green_sales" | "portal";
  responsibleExecutiveId: string | null;
  notes: string;
};

export function readLeadFicha(investorId: string): LeadFicha | null {
  const lead = loadLeads().find((l) => l.id === investorId);
  if (!lead) return null;
  return {
    name: lead.name ?? "",
    email: lead.email ?? "",
    whatsapp: lead.whatsapp ?? "",
    city: lead.city ?? "",
    scope: lead.scope === "green_sales" ? "green_sales" : "portal",
    responsibleExecutiveId: lead.responsibleExecutiveId ?? null,
    notes: lead.notes ?? "",
  };
}

const FIELD_LABEL: Record<keyof LeadFicha, string> = {
  name: "Nome",
  email: "E-mail",
  whatsapp: "WhatsApp / Telefone",
  city: "Cidade",
  scope: "Origem",
  responsibleExecutiveId: "Executivo responsável",
  notes: "Observações",
};

export function saveLeadFicha(input: {
  investorId: string;
  ficha: LeadFicha;
  actorId: string;
  actorName: string;
  actorRole?: string;
}): LeadRecord | null {
  const before = readLeadFicha(input.investorId);
  if (!before) return null;
  const next = input.ficha;
  const changed = (Object.keys(FIELD_LABEL) as (keyof LeadFicha)[]).filter(
    (k) => (before[k] ?? "") !== (next[k] ?? ""),
  );
  if (changed.length === 0) return null;

  const personalized = next.scope === "green_sales" && Boolean(next.responsibleExecutiveId);
  const updated = updateLead(input.investorId, {
    name: next.name.trim(),
    email: next.email.trim(),
    whatsapp: next.whatsapp.trim(),
    city: next.city.trim(),
    notes: next.notes,
    scope: personalized ? "green_sales" : "portal",
    responsibleExecutiveId: personalized ? next.responsibleExecutiveId : null,
    personalized,
  });
  if (!updated) return null;

  const details = changed.map((k) => FIELD_LABEL[k]).join(", ");
  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole ?? "Executivo",
    module: "investidores",
    action: "Ficha do investidor atualizada no Workspace",
    target: updated.name,
    details: `Campos alterados: ${details}.`,
    severity: "info",
  });
  recordCrmEvent({
    investorId: input.investorId,
    event: "sincronizacao",
    origin: updated.scope === "green_sales" ? "Green Sales" : "Portal Velox",
    reason: `Ficha atualizada por ${input.actorName} — ${details}.`,
    ownerId: updated.responsibleExecutiveId ?? input.actorId,
    actorId: input.actorId,
  });
  emitEvent({
    type: "profile.updated",
    investorId: input.investorId,
    actorId: input.actorId,
    payload: { fields: changed },
  });
  notifySync("leads");
  notifySync("timeline");
  notifySync("audit");
  return updated;
}
