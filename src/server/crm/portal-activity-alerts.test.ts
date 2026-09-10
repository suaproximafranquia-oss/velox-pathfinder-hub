import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ events: [] as Array<{ investor_id: string; event: string; created_at: string }>, concluded: [] as Array<{ details: { actionKey: string } }> }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const state: Record<string, unknown> = {};
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: table === "portal_leads" ? [{ id: "TEST-lead", is_test: false, archived_at: null }] : table === "portal_journey_events" ? fake.events : fake.concluded }),
        insert: () => Promise.resolve({ data: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: table === "portal_leads" ? [{ id: "TEST-lead", is_test: false, archived_at: null }] : table === "portal_journey_events" ? fake.events : fake.concluded }),
      };
      return chain;
    },
  },
}));

import { listPortalActivityAlerts } from "./portal-activity-alerts.server";

beforeEach(() => { fake.events = []; fake.concluded = []; });

describe("alertas reais do Portal", () => {
  it("não expira alerta aberto com mais de sete dias", async () => {
    fake.events = [{ investor_id: "TEST-lead", event: "manual.started", created_at: "2026-08-01T12:00:00.000Z" }];
    const rows = await listPortalActivityAlerts("TEST-exec", "2026-09-10T12:00:00.000Z");
    expect(rows).toHaveLength(1);
  });

  it("agrupa acessos com menos de sete dias desde o último qualificável", async () => {
    fake.events = [
      { investor_id: "TEST-lead", event: "manual.started", created_at: "2026-08-01T12:00:00.000Z" },
      { investor_id: "TEST-lead", event: "manual.chapter.completed", created_at: "2026-08-07T12:00:00.000Z" },
    ];
    const rows = await listPortalActivityAlerts("TEST-exec", "2026-09-10T12:00:00.000Z");
    expect(rows).toHaveLength(1);
  });

  it("gera novo alerta após sete dias completos do último qualificável", async () => {
    fake.events = [
      { investor_id: "TEST-lead", event: "manual.started", created_at: "2026-08-01T12:00:00.000Z" },
      { investor_id: "TEST-lead", event: "manual.completed", created_at: "2026-08-08T12:00:00.000Z" },
    ];
    const rows = await listPortalActivityAlerts("TEST-exec", "2026-09-10T12:00:00.000Z");
    expect(rows).toHaveLength(2);
  });

  it("não devolve alerta já concluído", async () => {
    const at = "2026-08-01T12:00:00.000Z";
    fake.events = [{ investor_id: "TEST-lead", event: "manual.started", created_at: at }];
    fake.concluded = [{ details: { actionKey: `portal_alert:TEST-lead:${at}` } }];
    const rows = await listPortalActivityAlerts("TEST-exec", "2026-09-10T12:00:00.000Z");
    expect(rows).toEqual([]);
  });
});
