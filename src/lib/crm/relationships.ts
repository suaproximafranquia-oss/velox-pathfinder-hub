/**
 * CRM de Relacionamento — camada de leitura sobre o Portal do Executivo.
 *
 * O CRM NÃO possui base própria: ele lê exatamente os mesmos investidores
 * do Workspace do Executivo (`listAllInvestors`) e apenas os apresenta em
 * formato de conversas. Nenhum cadastro é criado, duplicado ou alterado
 * aqui — o Portal do Executivo continua sendo a fonte oficial dos dados.
 */
import {
  listAllInvestors,
  STATUS_LABEL,
  formatRelative,
  type Investor,
} from "@/lib/executive-data";
import { canViewAllInvestors, loadUsers } from "@/lib/executive-auth";
import { resolveLeadState, LEAD_STATE_META, type LeadState } from "@/lib/lead-state";
import type { CrmActor } from "@/lib/crm/types";
import {
  ensureOwnership,
  officialOwnerId,
  findDuplicate,
  type CrmDuplicate,
} from "@/lib/crm/ownership";
import { accessModeFor, type CrmAccessMode } from "@/lib/crm/permissions";
import { recordCrmEvent } from "@/lib/crm/timeline";
import {
  resolveRelationshipState,
  isReactivated,
  type CrmRelationshipState,
} from "@/lib/crm/relationship-state";
import { recordReactivationAlert } from "@/lib/workspace-alerts";
import { getJourney } from "@/lib/journey/engine";
import { isJourneyOnly, getCommercial, isArchived } from "@/lib/crm/commercial";
import { isCrmAdministrator, isCrmSupervisor } from "@/lib/crm/permissions";
import { listCrmMessages } from "@/lib/crm/messages";

/**
 * ETAPA 02.1 · ITEM 08 — a Gestora não recebe acesso automático a todas as
 * conversas: ela só enxerga um relacionamento quando participa efetivamente
 * do atendimento (é proprietária ou já registrou mensagem na conversa).
 */
function supervisorParticipates(investorId: string, userId: string): boolean {
  return listCrmMessages(investorId).some((m) => m.authorId === userId);
}

/** Duplicidade já auditada nesta sessão — evita repetir o mesmo evento. */
const duplicateEventRecorded = new Set<string>();
/**
 * WhatsApp do investidor (DEF 2.4.10 §4): sempre que o número existir em
 * qualquer camada oficial (cadastro ou jornada) ele é exibido.
 */
function phoneOf(i: Investor): string {
  const direct = (i.phone ?? "").trim();
  if (direct) return direct;
  return (getJourney(i.id)?.phone ?? "").trim();
}


export type CrmConversation = {
  id: string;
  name: string;
  initials: string;
  photoUrl?: string;
  phone: string;
  email: string;
  city: string;
  /** Rótulo do último evento real registrado (ou origem do Lead). */
  lastInteraction: string;
  /** Resumo curto do momento atual do investidor. */
  summary: string;
  statusLabel: string;
  state: LeadState;
  stateLabel: string;
  /** Estágio automático do relacionamento (Motor Inteligente). */
  relationshipState: CrmRelationshipState;
  lastActivityIso: string;
  lastActivityLabel: string;
  originLabel: string;
  workspaceLabel: string;
  ownerName: string;
  /** Executivo responsável oficial (imutável por sincronização). */
  ownerId: string;
  /** Camada de permissão aplicada a este relacionamento. */
  access: CrmAccessMode;
  /**
   * Jornada Digital (DEF 2.4.11): conversa congelada, sem Lead comercial
   * nem Card no Workspace. O envio manual permanece bloqueado.
   */
  journeyOnly: boolean;
  /** Conversa arquivada pelo Executivo — oculta da lista principal. */
  archived: boolean;
  /** Data/hora de criação do Relacionamento Comercial, quando existir. */
  relationshipStartedAt?: string;
  /** Relacionamento ativo já existente com o mesmo telefone/e-mail. */
  duplicate?: CrmDuplicate & { ownerName: string; investorName: string };
  readingPct: number;
  investor: Investor;
};

const ORIGIN_LABEL: Record<string, string> = {
  green_sales: "Green Sales",
  portal: "Portal Velox",
  manual: "Cadastro manual",
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function summaryOf(i: Investor): string {
  if (i.readingPct >= 100) return "Concluiu a leitura do Manual do Investidor.";
  if (i.readingPct > 0) return `Leitura em andamento — ${i.currentChapter}.`;
  if (i.diagnostic !== "não iniciado") return "Perfil comercial em construção.";
  return "Investidor identificado, ainda sem histórico de leitura.";
}

/**
 * Conversas visíveis ao Executivo autenticado. Reaproveita a MESMA regra
 * de permissão da Central do Executivo: quem vê todos os investidores no
 * Workspace vê todos aqui; os demais veem apenas os próprios.
 */
export function listConversations(actor: CrmActor): CrmConversation[] {
  const users = loadUsers();
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  // O CRM enxerga também as Jornadas Digitais — o Workspace, não.
  // Conversas arquivadas continuam existindo: apenas saem da lista
  // principal do CRM até que o Executivo as desarquive.
  const all = listAllInvestors({ includeJourneyOnly: true, includeArchived: true });
  const nameByInvestorId = new Map(all.map((i) => [i.id, i.name]));

  // Base única: o vínculo oficial é garantido (e preservado) para todos.
  for (const i of all) {
    const { record, created } = ensureOwnership(i);
    if (created) {
      recordCrmEvent({
        investorId: i.id,
        event: "relacionamento_oficial",
        origin: i.origin ?? "portal",
        reason: "Primeiro relacionamento registrado na base do CRM.",
        ownerId: record.ownerId,
        actorId: "sistema",
      });
    }
  }

  const scoped = isCrmAdministrator(actor.role)
    ? all
    : isCrmSupervisor(actor.role)
      ? all.filter(
          (i) =>
            officialOwnerId(i) === actor.userId ||
            supervisorParticipates(i.id, actor.userId),
        )
      : all.filter((i) => officialOwnerId(i) === actor.userId);

  return scoped
    .map<CrmConversation>((i) => {
      const state = resolveLeadState({ id: i.id, lastActivity: i.lastActivity });
      const ownerId = officialOwnerId(i);
      const access = accessModeFor(actor, ownerId);
      const dup = findDuplicate(i, all);
      const journeyOnly = isJourneyOnly(i.id);
      // Reativação: retorno ao Portal após inatividade gera alerta automático.
      if (isReactivated({ id: i.id, lastInvestorActivityIso: i.lastActivity })) {
        recordReactivationAlert({
          ownerUserId: ownerId,
          investorId: i.id,
          investorName: i.name,
          dateIso: i.lastActivity,
        });
      }
      // O evento de duplicidade é registrado UMA única vez por relacionamento:
      // antes ele era gravado a cada renderização, poluindo a auditoria.
      if (dup && !duplicateEventRecorded.has(i.id)) {
        duplicateEventRecorded.add(i.id);
        recordCrmEvent({
          investorId: i.id,
          event: "duplicidade_detectada",
          origin: i.origin ?? "portal",
          reason: `Registro coincidente por ${dup.matchedBy}.`,
          ownerId,
          actorId: actor.userId,
        });
      }
      return {
        id: i.id,
        name: i.name,
        initials: initialsOf(i.name),
        phone: phoneOf(i),
        email: i.email,
        city: i.city,
        lastInteraction: i.lastEventLabel ?? STATUS_LABEL[i.status],
        summary: summaryOf(i),
        statusLabel: STATUS_LABEL[i.status],
        state,
        stateLabel: LEAD_STATE_META[state].label,
        relationshipState: resolveRelationshipState({
          id: i.id,
          lastInvestorActivityIso: i.lastActivity,
        }),
        lastActivityIso: i.lastActivity,
        lastActivityLabel: formatRelative(i.lastActivity),
        originLabel: ORIGIN_LABEL[i.origin ?? "portal"] ?? "Portal Velox",
        workspaceLabel: (i.origin ?? "portal") === "green_sales" ? "Green Sales" : "Portal",
        ownerName: nameById.get(ownerId) ?? "—",
        ownerId,
        access,
        journeyOnly,
        archived: isArchived(i.id),
        relationshipStartedAt: getCommercial(i.id)?.startedAt,
        duplicate: dup
          ? {
              ...dup,
              ownerName: nameById.get(dup.ownerId) ?? "—",
              investorName: nameByInvestorId.get(dup.investorId) ?? "—",
            }
          : undefined,
        readingPct: i.readingPct,
        investor: i,
      };
    })
    .sort((a, b) => (a.lastActivityIso < b.lastActivityIso ? 1 : -1));
}

export function filterConversations(
  items: CrmConversation[],
  query: string,
): CrmConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q),
  );
}

export const CRM_STATE_DOT: Record<LeadState, string> = {
  novo: "bg-emerald-500",
  em_andamento: "bg-amber-400",
  encerrado: "bg-[color:var(--crm-muted)]/50",
};
