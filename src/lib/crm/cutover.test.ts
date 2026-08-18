import { describe, expect, it } from "vitest";
import { cadenceEligibility, isHistoricalLead, leadEntryDate } from "./cutover";
import { planE30 } from "@/lib/relationship/reactivation";

const ATIVACAO = "2026-09-01";

describe("data de ativação da cadência", () => {
  it("sem data configurada nenhum lead é elegível", () => {
    const lead = { externalCreatedAt: "2026-09-05T12:00:00Z" };
    expect(cadenceEligibility(lead, null).eligible).toBe(false);
    expect(isHistoricalLead(lead, null)).toBe(true);
  });

  it("lead anterior à ativação é histórico e não entra em cadência", () => {
    const lead = { externalCreatedAt: "2026-08-20T12:00:00Z" };
    expect(isHistoricalLead(lead, ATIVACAO)).toBe(true);
    expect(cadenceEligibility(lead, ATIVACAO).eligible).toBe(false);
  });

  it("ressincronizar um lead antigo não o transforma em lead novo", () => {
    const lead = { externalCreatedAt: "2026-08-20T12:00:00Z", createdAt: new Date().toISOString() };
    expect(leadEntryDate(lead)).toBe("2026-08-20");
    expect(cadenceEligibility(lead, ATIVACAO).eligible).toBe(false);
  });

  it("a entrada real na coluna NOVOS tem precedência sobre datas técnicas", () => {
    const lead = {
      enteredEntryStageAt: "2026-09-10T12:00:00Z",
      externalCreatedAt: "2024-01-05T12:00:00Z",
    };
    expect(leadEntryDate(lead)).toBe("2026-09-10");
    expect(cadenceEligibility(lead, ATIVACAO).eligible).toBe(true);
  });

  it("lead novo após a ativação é elegível", () => {
    expect(cadenceEligibility({ externalCreatedAt: "2026-09-05T12:00:00Z" }, ATIVACAO).eligible).toBe(
      true,
    );
  });

  it("sem data de entrada confiável o lead é tratado como histórico", () => {
    expect(isHistoricalLead({}, ATIVACAO)).toBe(true);
  });

  it("E30 nunca é criado para histórico e permanece desativado", () => {
    expect(
      planE30({
        lead: { externalCreatedAt: "2026-08-01T12:00:00Z" },
        journeyStartedAt: null,
        activationDate: ATIVACAO,
      }).scheduled,
    ).toBe(false);
    expect(
      planE30({
        lead: { externalCreatedAt: "2026-09-05T12:00:00Z" },
        journeyStartedAt: "2026-09-05T12:00:00Z",
        activationDate: ATIVACAO,
      }).scheduled,
    ).toBe(false);
  });
});
