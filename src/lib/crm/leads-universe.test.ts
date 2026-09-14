import { describe, expect, it } from "vitest";
import type { CrmLeadView } from "./leads.functions";

function lead(overrides: Partial<CrmLeadView>): CrmLeadView {
  return {
    id: "TEST-crm-id",
    externalId: "TEST-external-id",
    name: "Lead histórico",
    phone: "",
    email: "",
    origin: "GreenSales",
    captureForm: null,
    pipelineName: null,
    stageKey: "frio",
    externalCreatedAt: null,
    ingestedAt: "2026-01-01T00:00:00.000Z",
    lastSyncedAt: null,
    syncStatus: "OK",
    syncError: null,
    welcomeStatus: "NOT_APPLICABLE",
    welcomeSentAt: null,
    welcomeError: null,
    welcomeLink: null,
    responsibleExecutiveId: null,
    hasOperationalCard: false,
    ...overrides,
  };
}

describe("universo do Portal Leads", () => {
  it("representa lead histórico do espelho sem convertê-lo em card operacional", () => {
    const historical = lead({ externalId: "TEST-history" });
    expect(historical.hasOperationalCard).toBe(false);
    expect(historical.welcomeStatus).toBe("NOT_APPLICABLE");
    expect(historical.responsibleExecutiveId).toBeNull();
  });

  it("preserva o estado operacional quando há card para o mesmo external_id", () => {
    const operational = lead({
      externalId: "TEST-operational",
      hasOperationalCard: true,
      responsibleExecutiveId: "TEST-executive",
      welcomeStatus: "PENDING",
    });
    expect(operational.hasOperationalCard).toBe(true);
    expect(operational.responsibleExecutiveId).toBe("TEST-executive");
    expect(operational.externalId).toBe("TEST-operational");
  });
});