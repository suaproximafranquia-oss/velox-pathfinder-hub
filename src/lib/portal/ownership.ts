/**
 * COMANDO 4E §48/§49/§50 — FONTE CENTRAL DE PROPRIETÁRIO, JORNADA E
 * ENGAJAMENTO.
 *
 * Uma única decisão para toda a plataforma. Nenhuma tela reimplementa
 * a regra; nenhuma jornada ou engajamento é duplicado por usuário: o
 * registro é único e possui múltiplos ESCOPOS DE LEITURA.
 */
import type { WorkspaceScope } from "@/lib/portal-workspace";
import type { EntryOriginKind } from "@/lib/portal/entry-origin";

export type OwnershipCase = "A" | "B" | "C" | "D" | "E" | "F";

export type ExistingOwnership = {
  /** Proprietário original/histórico. */
  ownerId: string | null;
  /** Responsável operacional atual (redistribuição). */
  operationalOwnerId?: string | null;
  scope?: WorkspaceScope | null;
  /** Escopos compartilhados de leitura (Jornada e Engajamento). */
  sharedExecutiveIds?: string[] | null;
};

export type OwnershipDecision = {
  case: OwnershipCase;
  /** Proprietário original — nunca alterado automaticamente. */
  ownerId: string | null;
  /** Responsável operacional atual. */
  operationalOwnerId: string | null;
  scope: WorkspaceScope;
  /** Escopos de leitura compartilhada da MESMA jornada/engajamento. */
  sharedExecutiveIds: string[];
  personalized: boolean;
  reason: string;
};

function uniq(list: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const value of list) {
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

/**
 * Decisão oficial de proprietário na entrada pelo Gateway.
 *
 * A — link de Executivo comum → proprietário = Executivo do link;
 * B — link da Gestora + pessoa já pertence a Executivo → proprietário
 *     preservado, Gestora entra como escopo compartilhado;
 * C — link da Gestora + pessoa sem proprietário → proprietário = Gestora,
 *     escopo Central Única;
 * D — link cru + pessoa existente → proprietário preservado;
 * E — link cru + pessoa nova → proprietário padrão (Administrador).
 */
export function resolveOwnership(input: {
  origin: EntryOriginKind;
  entryExecutiveId: string | null;
  existing: ExistingOwnership | null;
  /** Proprietário padrão do acesso institucional (Administrador). */
  defaultOwnerId: string;
}): OwnershipDecision {
  const existing = input.existing;
  const shared = uniq(existing?.sharedExecutiveIds ?? []);
  const existingOwner = existing?.ownerId ?? null;

  if (input.origin === "PERSONALIZED_EXECUTIVE" && input.entryExecutiveId) {
    // §6 — o vínculo é determinado pelo link; nenhuma pesquisa global.
    return {
      case: "A",
      ownerId: input.entryExecutiveId,
      operationalOwnerId: input.entryExecutiveId,
      scope: "green_sales",
      sharedExecutiveIds: uniq([...shared, existingOwner]).filter(
        (id) => id !== input.entryExecutiveId,
      ),
      personalized: true,
      reason: "Link personalizado de Executivo — registro no Workspace Green Sales do link.",
    };
  }

  if (input.origin === "LARISSA_MANAGER" && input.entryExecutiveId) {
    if (existingOwner && existingOwner !== input.entryExecutiveId) {
      // §8 — proprietário preservado; Gestora vira escopo compartilhado.
      return {
        case: "B",
        ownerId: existingOwner,
        operationalOwnerId: existing?.operationalOwnerId ?? existingOwner,
        scope: existing?.scope ?? "green_sales",
        sharedExecutiveIds: uniq([...shared, input.entryExecutiveId]),
        personalized: true,
        reason:
          "Link da Gestora — proprietário original preservado e jornada compartilhada com a Gestora.",
      };
    }
    // §11 — sem proprietário: pertence à própria Gestora (Central Única).
    return {
      case: "C",
      ownerId: input.entryExecutiveId,
      operationalOwnerId: input.entryExecutiveId,
      scope: "central_unica",
      sharedExecutiveIds: shared.filter((id) => id !== input.entryExecutiveId),
      personalized: true,
      reason: "Link da Gestora sem proprietário — registro na Central Única da Gestora.",
    };
  }

  if (existing && existingOwner) {
    // §18 — link cru nunca troca proprietário conhecido.
    return {
      case: "D",
      ownerId: existingOwner,
      operationalOwnerId: existing.operationalOwnerId ?? existingOwner,
      scope: existing.scope ?? "green_sales",
      sharedExecutiveIds: shared,
      personalized: true,
      reason: "Acesso institucional de investidor existente — proprietário mantido.",
    };
  }

  // §19 — novo investidor sem proprietário: padrão do Administrador.
  return {
    case: "E",
    ownerId: input.defaultOwnerId,
    operationalOwnerId: input.defaultOwnerId,
    scope: "portal",
    sharedExecutiveIds: shared.filter((id) => id !== input.defaultOwnerId),
    personalized: false,
    reason: "Acesso institucional de novo investidor — proprietário padrão do Portal.",
  };
}

/**
 * §36/§38 — redistribuição não duplica lead: preserva o proprietário
 * original, troca apenas o responsável operacional e amplia o escopo de
 * leitura.
 */
export function applyRedistributionOwnership(input: {
  current: ExistingOwnership;
  recipientId: string;
  /** Quem executou a redistribuição (Gestora). */
  redistributedBy: string;
}): OwnershipDecision {
  const shared = uniq([
    ...(input.current.sharedExecutiveIds ?? []),
    input.redistributedBy,
    input.current.ownerId,
  ]).filter((id) => id !== input.recipientId);
  return {
    case: "F",
    ownerId: input.current.ownerId,
    operationalOwnerId: input.recipientId,
    scope: "redistribuicao",
    sharedExecutiveIds: shared,
    personalized: true,
    reason: "Redistribuição — responsável operacional alterado, histórico preservado.",
  };
}

/**
 * §9/§10/§37 — uma jornada, um engajamento, vários escopos de leitura.
 */
export function journeyViewers(record: ExistingOwnership): string[] {
  return uniq([
    record.ownerId,
    record.operationalOwnerId ?? null,
    ...(record.sharedExecutiveIds ?? []),
  ]);
}

export function canViewJourney(
  record: ExistingOwnership,
  viewer: { id: string; isGlobal?: boolean },
): boolean {
  if (viewer.isGlobal) return true;
  return journeyViewers(record).includes(viewer.id);
}

/**
 * §22 — conflito de identidade nunca faz merge automático.
 */
export type IdentityMatch = {
  byEmail: string | null;
  byPhone: string | null;
};

export type IdentityResolution =
  | { kind: "new" }
  | { kind: "match"; investorId: string }
  | { kind: "conflict"; emailInvestorId: string; phoneInvestorId: string; note: string };

export function resolveIdentityMatch(match: IdentityMatch): IdentityResolution {
  const { byEmail, byPhone } = match;
  if (byEmail && byPhone && byEmail !== byPhone) {
    return {
      kind: "conflict",
      emailInvestorId: byEmail,
      phoneInvestorId: byPhone,
      note: "Conflito de identidade — revisão necessária.",
    };
  }
  const found = byEmail ?? byPhone;
  return found ? { kind: "match", investorId: found } : { kind: "new" };
}
