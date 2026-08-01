/**
 * Backup de Conversas (DEF 2.4.9 §2).
 *
 * Registro permanente e SOMENTE LEITURA de cada relacionamento. Nenhuma
 * função operacional: o backup apenas consolida o que já existe na base
 * oficial (investidores, timeline, reuniões e notas do Executivo).
 */
import { listAllInvestors, STATUS_LABEL, formatRelative } from "@/lib/executive-data";
import { loadUsers } from "@/lib/executive-auth";
import { officialOwnerId } from "@/lib/crm/ownership";
import { resolveLeadState, LEAD_STATE_META } from "@/lib/lead-state";
import { listCrmTimeline, type CrmTimelineEntry } from "@/lib/crm/timeline";
import { listMeetings, type Meeting } from "@/lib/meetings";
import { listComments, type InvestorComment } from "@/lib/investor-comments";
import { journeySummary } from "@/lib/journey/insights";
import type { JourneySummary } from "@/lib/journey/insights";
import { getCommercial } from "@/lib/crm/commercial";

export type CrmBackupRecord = {
  investorId: string;
  name: string;
  executiveId: string;
  executiveName: string;
  workspaceLabel: string;
  statusLabel: string;
  stateLabel: string;
  lastMovementIso: string;
  lastMovementLabel: string;
  city: string;
  phone: string;
  email: string;
  originLabel: string;
  readingPct: number;
  /** "green_sales" (Central Corporativa) ou "portal" (Backup do Executivo). */
  workspaceKind: "green_sales" | "portal";
  /** Relacionamento arquivado — disponível para restauração. */
  archived: boolean;
  archivedAtLabel?: string;
};

const ORIGIN_LABEL: Record<string, string> = {
  green_sales: "Green Sales",
  portal: "Portal Velox",
  manual: "Cadastro manual",
};

/** Todos os backups da Central, do mais recente ao mais antigo. */
export function listConversationBackups(): CrmBackupRecord[] {
  const nameById = new Map(loadUsers().map((u) => [u.id, u.name]));
  return listAllInvestors({ includeJourneyOnly: true, includeArchived: true })
    .map<CrmBackupRecord>((i) => {
      const ownerId = officialOwnerId(i);
      const state = resolveLeadState({ id: i.id, lastActivity: i.lastActivity });
      const origin = i.origin ?? "portal";
      const commercial = getCommercial(i.id);
      return {
        investorId: i.id,
        name: i.name,
        executiveId: ownerId,
        executiveName: nameById.get(ownerId) ?? "—",
        workspaceLabel: origin === "green_sales" ? "Green Sales" : "Portal",
        statusLabel: STATUS_LABEL[i.status],
        stateLabel: LEAD_STATE_META[state].label,
        lastMovementIso: i.lastActivity,
        lastMovementLabel: formatRelative(i.lastActivity),
        city: i.city,
        phone: i.phone,
        email: i.email,
        originLabel: ORIGIN_LABEL[origin] ?? "Portal Velox",
        readingPct: i.readingPct,
        workspaceKind: origin === "green_sales" ? "green_sales" : "portal",
        archived: commercial?.state === "arquivado",
        archivedAtLabel: commercial?.archivedAt
          ? new Date(commercial.archivedAt).toLocaleString("pt-BR")
          : undefined,
      };
    })
    .sort((a, b) => (a.lastMovementIso < b.lastMovementIso ? 1 : -1));
}

export type CrmBackupDetail = {
  record: CrmBackupRecord;
  journey: JourneySummary | null;
  timeline: CrmTimelineEntry[];
  meetings: Meeting[];
  notes: InvestorComment[];
};

/** Conteúdo somente leitura do backup — sem IA, relatórios ou mensagens. */
export function getBackupDetail(record: CrmBackupRecord): CrmBackupDetail {
  return {
    record,
    journey: journeySummary(record.investorId),
    timeline: listCrmTimeline(record.investorId),
    meetings: listMeetings({ investorId: record.investorId }).sort((a, b) =>
      a.scheduledAt < b.scheduledAt ? 1 : -1,
    ),
    notes: listComments(record.investorId),
  };
}
