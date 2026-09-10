import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  last: "2026-08-01T12:00:00Z", reentry: vi.fn(async () => true), pending: vi.fn(), refresh: vi.fn(), upsert: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("./lead-service.server", async (original) => ({
  ...await original<typeof import("./lead-service.server")>(),
  getLeadEntryState: async () => ({ exists: true, entryCount: 1, lastEntryAt: fake.last, stageKey: "frio" }),
  upsertLead: fake.upsert, recordEvent: vi.fn(),
}));
vi.mock("./workspace-card.server", () => ({ refreshWorkspaceCardName: fake.refresh, ensureWorkspaceCard: async () => ({ ok: true, cardId: "gs_TEST", created: false }) }));
vi.mock("./responsible.server", () => ({ greenSalesVendorId: () => null, resolveResponsibleByVendorId: async () => null,
  resolveResponsibleByUserId: async () => null, backfillCardResponsible: vi.fn() }));
vi.mock("./identity.server", () => ({ resolveOrCreateInvestor: async () => ({ investorId: "TEST-investor" }), linkCanonicalInvestor: vi.fn() }));
vi.mock("./ownership.server", () => ({ applyOriginResponsibleChange: async () => ({ redistributed: false }) }));
vi.mock("./first-contact-mode.server", () => ({ resolveExecutiveE0Mode: async () => ({ mode: "manual" }) }));
vi.mock("./first-contact-queue.server", () => ({ deferFirstContact: vi.fn() }));
vi.mock("./automation.server", () => ({ loadSettings: vi.fn() }));
vi.mock("./e0-actions.server", () => ({ createPendingE0Action: fake.pending }));
vi.mock("@/server/relationship/execution-mode.server", () => ({ executionMode: () => ({ simulated: true }) }));
vi.mock("@/server/relationship/reentry-open.server", () => ({ openCommercialReentry: fake.reentry }));
import { intakeLead, type IntakeContext } from "./lead-intake.server";
import { isNewCommercialEntry } from "./lead-service.server";
const context = { pipeline: { pipelineId: "TEST", externalId: "TEST", name: "TEST", stages: [
  { key: "novos", externalTag: "26", position: 1, isEntry: true },
  { key: "frio", externalTag: "59", position: 9, isEntry: false },
] }, settings: { cadenceActivationDate: "2026-09-01" } } as IntakeContext;
beforeEach(() => {
  fake.last = "2026-08-01T12:00:00Z";
  vi.clearAllMocks();
  fake.upsert.mockImplementation(async (input) => {
    if (isNewCommercialEntry(fake.last, input.lastEntryAt)) fake.last = input.lastEntryAt;
    return { lead: { id: "TEST-crm", name: "Oficial", entered_entry_stage_at: "2026-08-01T12:00:00Z" },
      created: false, changed: true, deduplicated: false, enteredEntryStage: false };
  });
});
it("nova data comercial com FRIOS antigo abre RE0, sem E0, mesmo com entrada na etapa anterior ao corte", async () => {
  const raw = { id: "TEST", name: "Oficial", last_register_at: "2026-09-09T12:00:00Z", tags: [{ id: 26 }, { id: 59 }] };
  await intakeLead(raw, context);
  await intakeLead(raw, context);
  expect(fake.reentry).toHaveBeenCalledTimes(1);
  expect(fake.reentry).toHaveBeenCalledWith({ leadId: "gs_TEST", submissionKey: "entry:2026-09-09T12:00:00Z", at: raw.last_register_at });
  expect(fake.pending).not.toHaveBeenCalled();
  expect(fake.upsert.mock.calls[0][0]).toMatchObject({ tags: raw.tags, stageKey: "frio", externalId: "TEST" });
});
it.each([null, "inválida", "2026-08-01T12:00:00Z", "2026-07-01T12:00:00Z"])("data ausente/igual/anterior/inválida (%s) não abre RE", async (last_register_at) => {
  await intakeLead({ id: "TEST", name: "Oficial", last_register_at, tags: [{ id: 59 }] }, context);
  expect(fake.reentry).not.toHaveBeenCalled();
  expect(fake.pending).not.toHaveBeenCalled();
});