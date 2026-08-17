/**
 * COMANDO 4E — testes da camada de identidade, origem, proprietário e
 * redistribuição. Nenhum dado real é tocado: as regras são puras.
 */
import { describe, expect, it } from "vitest";
import { resolveEntryOrigin, requiresSecondIdentificationScreen } from "./entry-origin";
import {
  resolveOwnership,
  applyRedistributionOwnership,
  resolveIdentityMatch,
  journeyViewers,
  canViewJourney,
} from "./ownership";
import { pickRecipient } from "./redistribution";

const ADMIN = "usr_thiago";

describe("origem da entrada", () => {
  it("link de executivo comum é entrada personalizada", () => {
    expect(resolveEntryOrigin({ executive: { id: "usr_paulo", role: "colaborador" } })).toBe(
      "PERSONALIZED_EXECUTIVE",
    );
  });

  it("link da Gestora é tratado como exceção da Central Única", () => {
    expect(resolveEntryOrigin({ executive: { id: "usr_larissa", role: "diretora" } })).toBe(
      "LARISSA_MANAGER",
    );
  });

  it("sem executivo distingue link cru de campanha", () => {
    expect(resolveEntryOrigin({})).toBe("RAW_PUBLIC");
    expect(resolveEntryOrigin({ campaign: "meta-ads" })).toBe("CAMPAIGN_DEFAULT");
  });

  it("segunda tela só aparece sem executivo identificado", () => {
    expect(requiresSecondIdentificationScreen("RAW_PUBLIC")).toBe(true);
    expect(requiresSecondIdentificationScreen("CAMPAIGN_DEFAULT")).toBe(true);
    expect(requiresSecondIdentificationScreen("PERSONALIZED_EXECUTIVE")).toBe(false);
    expect(requiresSecondIdentificationScreen("LARISSA_MANAGER")).toBe(false);
  });
});

describe("proprietário do investidor", () => {
  it("A — link personalizado define o proprietário pelo link", () => {
    const decision = resolveOwnership({
      origin: "PERSONALIZED_EXECUTIVE",
      entryExecutiveId: "usr_paulo",
      existing: null,
      defaultOwnerId: ADMIN,
    });
    expect(decision.case).toBe("A");
    expect(decision.ownerId).toBe("usr_paulo");
    expect(decision.scope).toBe("green_sales");
  });

  it("B — link da Gestora preserva o proprietário e compartilha a jornada", () => {
    const decision = resolveOwnership({
      origin: "LARISSA_MANAGER",
      entryExecutiveId: "usr_larissa",
      existing: { ownerId: "usr_carlos", scope: "green_sales" },
      defaultOwnerId: ADMIN,
    });
    expect(decision.case).toBe("B");
    expect(decision.ownerId).toBe("usr_carlos");
    expect(decision.sharedExecutiveIds).toContain("usr_larissa");
  });

  it("C — Gestora assume investidor sem proprietário na Central Única", () => {
    const decision = resolveOwnership({
      origin: "LARISSA_MANAGER",
      entryExecutiveId: "usr_larissa",
      existing: null,
      defaultOwnerId: ADMIN,
    });
    expect(decision.case).toBe("C");
    expect(decision.scope).toBe("central_unica");
  });

  it("D — link cru nunca troca o proprietário de investidor existente", () => {
    const decision = resolveOwnership({
      origin: "RAW_PUBLIC",
      entryExecutiveId: null,
      existing: { ownerId: "usr_milton", scope: "green_sales" },
      defaultOwnerId: ADMIN,
    });
    expect(decision.case).toBe("D");
    expect(decision.ownerId).toBe("usr_milton");
  });

  it("E — novo investidor institucional pertence ao Portal do Administrador", () => {
    const decision = resolveOwnership({
      origin: "RAW_PUBLIC",
      entryExecutiveId: null,
      existing: null,
      defaultOwnerId: ADMIN,
    });
    expect(decision.case).toBe("E");
    expect(decision.ownerId).toBe(ADMIN);
    expect(decision.scope).toBe("portal");
    expect(decision.personalized).toBe(false);
  });
});

describe("redistribuição", () => {
  it("preserva o proprietário original e troca só o responsável operacional", () => {
    const result = applyRedistributionOwnership({
      current: { ownerId: "usr_carlos", operationalOwnerId: "usr_carlos", scope: "green_sales" },
      recipientId: "usr_talita",
      redistributedBy: "usr_larissa",
    });
    expect(result.ownerId).toBe("usr_carlos");
    expect(result.operationalOwnerId).toBe("usr_talita");
    expect(result.scope).toBe("redistribuicao");
    expect(result.sharedExecutiveIds).toContain("usr_carlos");
  });

  it("pula o próprio proprietário sem consumir o turno", () => {
    const queue = [{ id: "usr_carlos" }, { id: "usr_talita" }, { id: "usr_milton" }];
    const first = pickRecipient({ queue, pointer: 0, ownerId: "usr_carlos" });
    expect(first.recipient?.id).toBe("usr_talita");
    const second = pickRecipient({
      queue,
      pointer: first.nextPointer,
      ownerId: "usr_paulo",
    });
    expect(second.recipient?.id).toBe("usr_milton");
  });

  it("não redistribui quando o único elegível é o proprietário", () => {
    const pick = pickRecipient({
      queue: [{ id: "usr_carlos" }],
      pointer: 0,
      ownerId: "usr_carlos",
    });
    expect(pick.recipient).toBeNull();
  });
});

describe("identidade e jornada", () => {
  it("não faz merge automático em caso de conflito", () => {
    const resolution = resolveIdentityMatch({
      byEmail: "lead_a",
      byPhone: "lead_b",
    });
    expect(resolution.kind).toBe("conflict");
  });

  it("reaproveita a identidade quando e-mail e telefone convergem", () => {
    const resolution = resolveIdentityMatch({ byEmail: "lead_a", byPhone: "lead_a" });
    expect(resolution.kind).toBe("match");
  });

  it("jornada única com múltiplos escopos de leitura", () => {
    const record = {
      ownerId: "usr_carlos",
      operationalOwnerId: "usr_talita",
      sharedExecutiveIds: ["usr_larissa"],
    };
    const viewers = journeyViewers(record);
    expect(viewers).toEqual(expect.arrayContaining(["usr_carlos", "usr_talita", "usr_larissa"]));
    expect(canViewJourney(record, "usr_larissa")).toBe(true);
    expect(canViewJourney(record, "usr_paulo")).toBe(false);
  });
});
