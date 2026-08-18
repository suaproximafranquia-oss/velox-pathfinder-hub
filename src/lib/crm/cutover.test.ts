import { describe, expect, it } from "vitest";
import { CADENCE_ACTIVATION_DATE } from "./cadence";
import {
  OPERATIONAL_CUTOVER_DATE,
  cadenceEligibility,
  isHistoricalLead,
  leadEntryDate,
} from "./cutover";
import { planE30 } from "@/lib/relationship/reactivation";

describe("data de corte operacional", () => {
  it("a fila de ligações usa exatamente a data de corte", () => {
    expect(CADENCE_ACTIVATION_DATE).toBe(OPERATIONAL_CUTOVER_DATE);
  });

  it("lead criado antes de 01/09 é histórico e não entra em cadência", () => {
    const lead = { externalCreatedAt: "2026-08-20T12:00:00Z" };
    expect(isHistoricalLead(lead)).toBe(true);
    expect(cadenceEligibility(lead).eligible).toBe(false);
  });

  it("ressincronizar um lead antigo não o transforma em lead novo", () => {
    // O instante da sincronização é hoje; a entrada real continua em agosto.
    const lead = { externalCreatedAt: "2026-08-20T12:00:00Z", createdAt: new Date().toISOString() };
    expect(leadEntryDate(lead)).toBe("2026-08-20");
    expect(cadenceEligibility(lead).eligible).toBe(false);
  });

  it("lead novo após a data de corte é elegível", () => {
    expect(cadenceEligibility({ externalCreatedAt: "2026-09-05T12:00:00Z" }).eligible).toBe(true);
  });

  it("sem data de entrada confiável o lead é tratado como histórico", () => {
    expect(isHistoricalLead({})).toBe(true);
  });

  it("E30 nunca é criado para histórico e permanece desativado", () => {
    expect(
      planE30({ lead: { externalCreatedAt: "2026-08-01T12:00:00Z" }, journeyStartedAt: null })
        .scheduled,
    ).toBe(false);
    expect(
      planE30({
        lead: { externalCreatedAt: "2026-09-05T12:00:00Z" },
        journeyStartedAt: "2026-09-05T12:00:00Z",
      }).scheduled,
    ).toBe(false);
  });
});
