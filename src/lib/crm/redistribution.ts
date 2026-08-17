/**
 * ETAPA 02.1 — Documento 02/03: Redistribuição oficial de Leads.
 *
 * Redistribuição NÃO é transferência entre Executivos: é a atribuição
 * inicial de um contato institucional que ainda não pertence a ninguém.
 *
 * Sequência obrigatória antes de qualquer redistribuição (ITEM 02):
 *   1. capturar o WhatsApp do contato;
 *   2. procurar em todas as carteiras Green Sales;
 *   3. procurar em todas as abas Redistribuição;
 *   4. procurar na aba Portal do colaborador híbrido;
 *   5. só então considerar o contato "sem proprietário".
 *
 * A fila é fixa, circular e persistente (ITEM 03).
 */
import { loadLeads, leadPhoneKey, updateLead, registerLead } from "@/lib/leads";
import { loadUsers } from "@/lib/executive-auth";
import { logAudit } from "@/lib/audit-log";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { recordOperationalAlert } from "@/lib/workspace-alerts";
import { startRelationship, hasCommercialRelationship } from "@/lib/crm/commercial";
import { notifySync } from "@/lib/sync-bus";
import type { WorkspaceScope } from "@/lib/portal-workspace";
import {
  pickRecipient,
  readPointer,
  writePointer,
  recordRedistribution,
} from "@/lib/portal/redistribution";
import { applyRedistributionOwnership } from "@/lib/portal/ownership";

/** Ordem oficial da fila (ITEM 03). Resolvida contra os usuários reais. */
export const REDISTRIBUTION_ORDER = [
  "Thiago",
  "Marton",
  "Paulo",
  "Milton",
  "Carlos",
  "Talita",
] as const;

export type RedistributionTarget = { id: string; name: string };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Fila oficial resolvida contra a base de colaboradores ativos. */
export function redistributionQueue(): RedistributionTarget[] {
  const users = loadUsers().filter((u) => u.status !== "inativo");
  const queue: RedistributionTarget[] = [];
  for (const label of REDISTRIBUTION_ORDER) {
    const match = users.find((u) => normalize(u.name).startsWith(normalize(label)));
    if (match && !queue.some((q) => q.id === match.id)) {
      queue.push({ id: match.id, name: match.name });
    }
  }
  return queue;
}

/** Ponteiro único da plataforma (ver `@/lib/portal/redistribution`). */
function readCursor(): number {
  return readPointer();
}

/**
 * Próximo Executivo da fila — apenas leitura. A Gestora visualiza quem
 * receberá o Lead, mas jamais escolhe manualmente.
 */
export function peekNextExecutive(): RedistributionTarget | null {
  const queue = redistributionQueue();
  if (queue.length === 0) return null;
  return queue[readCursor() % queue.length] ?? queue[0];
}

/**
 * Avança a fila e devolve o Executivo da vez. COMANDO 4E §34: quando o
 * próximo da fila é o próprio proprietário do lead, ele é PULADO sem
 * consumir o turno e o ponteiro segue a partir do destinatário real.
 */
function takeNextExecutive(currentOwnerId?: string | null): RedistributionTarget | null {
  const queue = redistributionQueue();
  if (queue.length === 0) return null;
  const pick = pickRecipient({
    queue: queue.map((q) => q.id),
    pointer: readCursor(),
    currentOwnerId: currentOwnerId ?? null,
  });
  if (!pick.recipientId) return null;
  writePointer(pick.nextPointer);
  return queue.find((q) => q.id === pick.recipientId) ?? null;
}

export type OwnershipCheck =
  | { owned: false }
  | {
      owned: true;
      scope: WorkspaceScope;
      leadId: string;
      leadName: string;
      ownerId: string | null;
      reason: string;
    };

const SCOPE_REASON: Record<WorkspaceScope, string> = {
  green_sales:
    "Este investidor já possui proprietário na Green Sales. Nenhuma redistribuição é permitida.",
  redistribuicao:
    "Este investidor já foi redistribuído anteriormente. O proprietário atual é mantido.",
  portal:
    "Este investidor pertence ao Portal do Investidor. Nenhuma redistribuição é permitida.",
  central_unica:
    "Este investidor pertence à Central Única da Gestora. A redistribuição é decidida por ela.",
};

/**
 * ITEM 02 — verificação completa de propriedade pelo WhatsApp, na ordem
 * oficial: Green Sales → Redistribuição → Portal.
 */
export function checkOwnershipByPhone(phone: string): OwnershipCheck {
  const key = leadPhoneKey(phone ?? "");
  if (key.length < 8) return { owned: false };
  const leads = loadLeads().filter((l) => leadPhoneKey(l.whatsapp) === key);
  if (leads.length === 0) return { owned: false };
  const order: WorkspaceScope[] = [
    "green_sales",
    "redistribuicao",
    "central_unica",
    "portal",
  ];
  for (const scope of order) {
    const hit = leads.find((l) => (l.scope ?? "portal") === scope);
    if (hit) {
      return {
        owned: true,
        scope,
        leadId: hit.id,
        leadName: hit.name,
        ownerId: hit.responsibleExecutiveId,
        reason: SCOPE_REASON[scope],
      };
    }
  }
  const fallback = leads[0]!;
  return {
    owned: true,
    scope: "portal",
    leadId: fallback.id,
    leadName: fallback.name,
    ownerId: fallback.responsibleExecutiveId,
    reason: SCOPE_REASON.portal,
  };
}

export type RedistributionResult =
  | { ok: true; executive: RedistributionTarget; leadId: string }
  | { ok: false; reason: string };

/**
 * ITEM 03/04 — executa a redistribuição. Nenhum registro é duplicado:
 * apenas a responsabilidade operacional é definida e a origem passa a
 * ser, permanentemente, "Redistribuição".
 */
export function redistributeContact(input: {
  name: string;
  phone: string;
  email?: string;
  origin?: string;
  actorId: string;
  actorName: string;
}): RedistributionResult {
  const ownership = checkOwnershipByPhone(input.phone);
  if (ownership.owned) {
    recordOperationalAlert({
      ownerUserId: input.actorId,
      category: "falha_operacional",
      title: `Redistribuição bloqueada — ${ownership.leadName}`,
      description: ownership.reason,
      investorId: ownership.leadId,
    });
    return { ok: false, reason: ownership.reason };
  }

  const executive = takeNextExecutive();
  if (!executive) {
    return {
      ok: false,
      reason: "Nenhum Executivo disponível na fila oficial de redistribuição.",
    };
  }

  const origin = input.origin ?? "Canal institucional";
  const { lead } = registerLead({
    identity: {
      name: input.name.trim() || "Contato institucional",
      email: (input.email ?? "").trim().toLowerCase(),
      whatsapp: input.phone.trim(),
      city: "",
    },
    material: "Contato institucional — Redistribuição",
    origin,
  });

  const routed =
    updateLead(lead.id, {
      scope: "redistribuicao",
      responsibleExecutiveId: executive.id,
      personalized: false,
    }) ?? lead;

  // Espelhamento no servidor: o Card nasce direto na aba Redistribuição.
  if (typeof window !== "undefined") {
    void import("@/lib/portal-leads.functions")
      .then((m) => m.redistributePortalLead({ data: { id: routed.id, executiveId: executive.id } }))
      .catch(() => {
        recordOperationalAlert({
          ownerUserId: input.actorId,
          category: "falha_operacional",
          title: `Falha na sincronização da redistribuição — ${routed.name}`,
          description:
            "O Lead foi redistribuído localmente, mas a sincronização com a base oficial falhou.",
          investorId: routed.id,
        });
      });
  }

  if (!hasCommercialRelationship(routed.id)) {
    startRelationship({
      investorId: routed.id,
      investorName: routed.name,
      actorId: input.actorId,
      actorName: input.actorName,
      actorRole: "Gestor",
      ownerId: executive.id,
      origin,
      source: "executivo",
    });
  }

  recordCrmEvent({
    investorId: routed.id,
    event: "distribuicao_realizada",
    origin,
    reason: `Redistribuição automática pela fila oficial — responsável: ${executive.name}.`,
    ownerId: executive.id,
    actorId: input.actorId,
  });

  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: "Gestor",
    module: "investidores",
    action: "Lead redistribuído",
    target: routed.name,
    details: `Origem: ${origin}. Responsável definido automaticamente pela fila oficial: ${executive.name}.`,
    severity: "info",
  });

  recordOperationalAlert({
    ownerUserId: executive.id,
    category: "lead_redistribuido",
    title: `Novo Lead redistribuído — ${routed.name}`,
    description: `Contato institucional atribuído pela Gestão. Disponível na aba Redistribuição do seu Workspace.`,
    investorId: routed.id,
  });
  recordOperationalAlert({
    ownerUserId: input.actorId,
    category: "lead_redistribuido",
    title: `Redistribuição concluída — ${routed.name}`,
    description: `Responsável definido pela fila oficial: ${executive.name}.`,
    investorId: routed.id,
  });

  notifySync("leads");
  notifySync("commercial");
  notifySync("timeline");
  notifySync("alerts");

  return { ok: true, executive, leadId: routed.id };
}

/**
 * CORREÇÃO — Redistribuição é automática, nunca manual.
 *
 * Sempre que um número entra em contato pelo CRM, o sistema decide
 * sozinho: se o WhatsApp já pertence a alguém (Green Sales,
 * Redistribuição ou Portal), a conversa vai para o proprietário atual;
 * se o número é desconhecido, o contato é atribuído automaticamente ao
 * próximo Executivo da fila oficial. Ninguém escolhe o responsável.
 */
export type InboundRouting =
  | { routed: "proprietario"; ownerId: string | null; leadId: string; leadName: string; scope: WorkspaceScope }
  | { routed: "fila"; ownerId: string; leadId: string; leadName: string; executiveName: string }
  /** COMANDO 4G §5 — número desconhecido NÃO é redistribuído sozinho. */
  | { routed: "sem_proprietario"; phone: string }
  | { routed: "indisponivel"; reason: string };

export function routeInboundWhatsapp(input: {
  phone: string;
  name?: string;
  origin?: string;
}): InboundRouting {
  const ownership = checkOwnershipByPhone(input.phone);
  if (ownership.owned) {
    return {
      routed: "proprietario",
      ownerId: ownership.ownerId,
      leadId: ownership.leadId,
      leadName: ownership.leadName,
      scope: ownership.scope,
    };
  }
  /**
   * COMANDO 4G §1/§5/§6 — a redistribuição é 100% MANUAL. Um contato
   * desconhecido apenas fica disponível para a Gestora decidir; a fila
   * só é consultada depois do clique em [ Redistribuir ].
   */
  return { routed: "sem_proprietario", phone: input.phone };
}

/** Histórico de contatos já roteados pela fila oficial (somente leitura). */
export function listRedistributedLeads(): Array<{
  id: string;
  name: string;
  phone: string;
  ownerId: string | null;
  ownerName: string;
  at: string;
}> {
  const nameById = new Map(loadUsers().map((u) => [u.id, u.name]));
  return loadLeads()
    .filter((l) => (l.scope ?? "portal") === "redistribuicao")
    .map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.whatsapp ?? "",
      ownerId: l.responsibleExecutiveId,
      ownerName: nameById.get(l.responsibleExecutiveId ?? "") ?? "—",
      at: l.createdAt,
    }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

/**
 * COMANDO 4E §31/§32/§35/§36 — redistribuição de um lead JÁ EXISTENTE a
 * partir da Central Única da Gestora.
 *
 * Não cria novo lead comercial: preserva identidade, histórico e jornada.
 * Altera apenas o responsável operacional, o escopo e o histórico de
 * redistribuição. O proprietário ORIGINAL é sempre preservado.
 */
/**
 * COMANDO 4G §7/§8 — plano de confirmação. Nada é executado aqui: a
 * fila só é consultada DEPOIS que a Gestora confirma.
 */
export type RedistributionPlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      leadId: string;
      leadName: string;
      currentOwnerId: string | null;
      currentOwnerName: string | null;
      /** §8 — lead que já possui Executivo responsável. */
      exceptional: boolean;
      message: string;
    };

export function planRedistribution(leadId: string): RedistributionPlan {
  const lead = loadLeads().find((l) => l.id === leadId);
  if (!lead) return { ok: false, reason: "Lead não encontrado." };
  const currentOwnerId = lead.operationalOwnerId ?? lead.responsibleExecutiveId ?? null;
  const ownerName = currentOwnerId
    ? (loadUsers().find((u) => u.id === currentOwnerId)?.name ?? null)
    : null;
  return {
    ok: true,
    leadId: lead.id,
    leadName: lead.name,
    currentOwnerId,
    currentOwnerName: ownerName,
    exceptional: Boolean(ownerName),
    message: ownerName
      ? `Este lead pertence ao Executivo ${ownerName}. Deseja redistribuí-lo mesmo assim?`
      : "Este lead ainda não possui um Executivo responsável. Deseja redistribuí-lo agora?",
  };
}

export function redistributeExistingLead(input: {
  leadId: string;
  actorId: string;
  actorName: string;
  reason?: string;
}): RedistributionResult {
  const lead = loadLeads().find((l) => l.id === input.leadId);
  if (!lead) return { ok: false, reason: "Lead não encontrado." };

  const currentOwner = lead.operationalOwnerId ?? lead.responsibleExecutiveId ?? null;
  const queue = redistributionQueue();
  const preview = pickRecipient({
    queue: queue.map((q) => q.id),
    pointer: readCursor(),
    currentOwnerId: currentOwner,
  });
  const executive = takeNextExecutive(currentOwner);
  if (!executive) {
    return { ok: false, reason: "Nenhum Executivo elegível na fila oficial." };
  }

  const decision = applyRedistributionOwnership({
    current: {
      ownerId: lead.originalOwnerId ?? lead.responsibleExecutiveId ?? null,
      operationalOwnerId: currentOwner,
      scope: lead.scope ?? null,
      sharedExecutiveIds: lead.sharedExecutiveIds ?? [],
    },
    recipientId: executive.id,
    redistributedBy: input.actorId,
  });

  const routed =
    updateLead(lead.id, {
      scope: "redistribuicao",
      responsibleExecutiveId: executive.id,
      operationalOwnerId: executive.id,
      originalOwnerId: decision.ownerId,
      sharedExecutiveIds: decision.sharedExecutiveIds,
      personalized: true,
    }) ?? lead;

  recordRedistribution({
    leadId: routed.id,
    leadName: routed.name,
    fromOwnerId: currentOwner,
    originalOwnerId: decision.ownerId,
    recipientId: executive.id,
    recipientName: executive.name,
    redistributedBy: input.actorId,
    redistributedByName: input.actorName,
    skipped: preview.skipped,
    exceptional: Boolean(currentOwner),
    reason: input.reason ?? "Redistribuição operacional da Gestora.",
    at: new Date().toISOString(),
  });

  recordCrmEvent({
    investorId: routed.id,
    event: "distribuicao_realizada",
    origin: routed.origin ?? "Central Única",
    reason: `Redistribuição pela Gestora — responsável operacional: ${executive.name}.`,
    ownerId: executive.id,
    actorId: input.actorId,
  });

  logAudit({
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: "Gestor",
    module: "investidores",
    action: "Lead redistribuído (Central Única)",
    target: routed.name,
    details: `Proprietário original preservado. Responsável operacional: ${executive.name}. Jornada e engajamento seguem compartilhados.`,
    severity: "info",
  });

  notifySync("leads");
  notifySync("commercial");
  notifySync("timeline");

  return { ok: true, executive, leadId: routed.id };
}
