/**
 * Transferência OFICIAL de proprietário de um Lead.
 *
 * Regra de negócio: quando o responsável muda, ele muda de verdade — no
 * registro do Lead (base local + Lovable Cloud), no vínculo de propriedade
 * do CRM, na Timeline, na Auditoria e na Central de Alertas. Nenhum módulo
 * pode continuar enxergando o dono antigo.
 *
 * Este é o ÚNICO caminho permitido para trocar o responsável.
 */
import { loadLeads, updateLead, type LeadRecord } from "@/lib/leads";
import { loadUsers } from "@/lib/executive-auth";
import { reassignOwnership } from "@/lib/crm/ownership";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { recordOperationalAlert } from "@/lib/workspace-alerts";
import { logAudit } from "@/lib/audit-log";
import { notifySync } from "@/lib/sync-bus";

export type TransferResult =
  | { ok: true; lead: LeadRecord; previousOwnerId: string | null }
  | { ok: false; reason: string };

function nameOf(userId: string | null): string {
  if (!userId) return "Administrador do Portal";
  return loadUsers().find((u) => u.id === userId)?.name ?? "Executivo";
}

function originLabel(lead: LeadRecord): string {
  const scope = lead.scope ?? "portal";
  return scope === "green_sales"
    ? "Green Sales"
    : scope === "redistribuicao"
      ? "Redistribuição"
      : "Portal Velox";
}

export function transferLeadOwnership(input: {
  investorId: string;
  newOwnerId: string | null;
  actorId: string;
  actorName: string;
  actorRole?: string;
  reason?: string;
}): TransferResult {
  const lead = loadLeads().find((l) => l.id === input.investorId);
  if (!lead) return { ok: false, reason: "Lead não localizado na base oficial." };

  const previousOwnerId = lead.responsibleExecutiveId ?? null;
  if (previousOwnerId === input.newOwnerId) {
    return { ok: false, reason: "O Lead já pertence a este Executivo." };
  }

  const scope = lead.scope ?? "portal";
  // A carteira de origem é preservada: transferir não é redistribuir.
  const updated = updateLead(lead.id, {
    responsibleExecutiveId: input.newOwnerId,
    personalized: scope === "green_sales" ? Boolean(input.newOwnerId) : lead.personalized,
  });
  if (!updated) return { ok: false, reason: "Não foi possível atualizar o Lead." };

  // Vínculo oficial do CRM: passa a valer para conversas, backup e permissões.
  reassignOwnership(lead.id, input.newOwnerId ?? "", originLabel(updated));

  // Gravação definitiva na base real, preservando a carteira.
  if (typeof window !== "undefined") {
    void import("@/lib/portal-leads.functions")
      .then((m) =>
        m.assignPortalLeadOwner({
          data: { id: lead.id, executiveId: input.newOwnerId },
        }),
      )
      .catch(() => {
        recordOperationalAlert({
          ownerUserId: input.actorId,
          category: "falha_operacional",
          title: `Falha ao sincronizar a transferência — ${updated.name}`,
          description:
            "O proprietário foi alterado localmente, mas a gravação na base oficial falhou.",
          investorId: lead.id,
        });
      });
  }

  const from = nameOf(previousOwnerId);
  const to = nameOf(input.newOwnerId);
  const detail = input.reason
    ? `${input.reason} (${from} → ${to}).`
    : `Proprietário alterado de ${from} para ${to}.`;

  recordCrmEvent({
    investorId: lead.id,
    event: "lead_redistribuido",
    origin: originLabel(updated),
    reason: detail,
    ownerId: input.newOwnerId ?? input.actorId,
    actorId: input.actorId,
  });

  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole ?? "Gestor",
    module: "investidores",
    action: "Proprietário do Lead alterado",
    target: updated.name,
    details: detail,
    severity: "warning",
  });

  if (input.newOwnerId) {
    recordOperationalAlert({
      ownerUserId: input.newOwnerId,
      category: "lead_redistribuido",
      title: `Lead transferido para você — ${updated.name}`,
      description: `${detail} Carteira: ${originLabel(updated)}.`,
      investorId: lead.id,
    });
  }
  if (previousOwnerId) {
    recordOperationalAlert({
      ownerUserId: previousOwnerId,
      category: "lead_redistribuido",
      title: `Lead transferido — ${updated.name}`,
      description: `${updated.name} passou a ser atendido por ${to}.`,
      investorId: lead.id,
    });
  }

  notifySync("leads");
  notifySync("commercial");
  notifySync("timeline");
  notifySync("audit");
  notifySync("alerts");

  return { ok: true, lead: updated, previousOwnerId };
}
