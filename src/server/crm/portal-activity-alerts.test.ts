import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  events: [] as Array<{ investor_id: string; event: string; module?: string | null; created_at: string }>,
  concluded: [] as Array<{ details: { actionKey: string } }>,
  viewedAt: "2026-07-01T12:00:00.000Z" as string | null,
  updatedViewedAt: null as string | null,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const state: Record<string, unknown> = {};
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        contains: () => chain,
        gte: () => chain,
        order: () => chain,
        maybeSingle: () => Promise.resolve({ data: table === "portal_leads" ? { id: "TEST-lead", viewed_at: fake.viewedAt, responsible_executive_id: "TEST-exec" } : fake.events[0] ?? null }),
        limit: () => Promise.resolve({ data: table === "portal_leads" ? [{ id: "TEST-lead", is_test: false, archived_at: null }] : table === "portal_journey_events" ? fake.events : fake.concluded }),
        insert: (value: { details?: { actionKey?: string } }) => {
          if (table === "relationship_engine_log" && value.details?.actionKey) fake.concluded.push({ details: { actionKey: value.details.actionKey } });
          return Promise.resolve({ data: null, error: null });
        },
        update: (value: { viewed_at?: string }) => {
          if (table === "portal_leads") fake.updatedViewedAt = value.viewed_at ?? null;
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) => resolve({ data: table === "portal_leads" ? [{ id: "TEST-lead", is_test: false, archived_at: null }] : table === "portal_journey_events" ? fake.events : fake.concluded }),
      };
      return chain;
    },
  },
}));

import { concludePortalActivityAlert, listPortalActivityAlerts } from "./portal-activity-alerts.server";

beforeEach(() => {
  fake.events = [];
  fake.concluded = [];
  fake.viewedAt = "2026-07-01T12:00:00.000Z";
  fake.updatedViewedAt = null;
});

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

  it("identifica o conteúdo acessado sem alterar a chave idempotente", async () => {
    const at = "2026-08-01T12:00:00.000Z";
    fake.events = [{ investor_id: "TEST-lead", event: "module.opened", module: "universo", created_at: at }];
    const rows = await listPortalActivityAlerts("TEST-exec", "2026-09-10T12:00:00.000Z");
    expect(rows[0]).toMatchObject({
      actionKey: `portal_alert:TEST-lead:${at}`,
      contentLabel: "Material Institucional",
    });
  });

  it("concluir valida a atividade e avança viewed_at somente até o alerta", async () => {
    const at = "2026-08-01T12:00:00.000Z";
    fake.events = [{ investor_id: "TEST-lead", event: "manual.started", created_at: at }];
    await concludePortalActivityAlert({
      actionKey: `portal_alert:TEST-lead:${at}`,
      leadId: "TEST-lead",
      userId: "TEST-user",
      executiveId: "TEST-exec",
    });
    expect(fake.updatedViewedAt).toBe(at);
    expect(fake.concluded).toEqual([{ details: { actionKey: `portal_alert:TEST-lead:${at}` } }]);
  });

  it("não aceita alerta de outro lead", async () => {
    await expect(concludePortalActivityAlert({
      actionKey: "portal_alert:outro:2026-08-01T12:00:00.000Z",
      leadId: "TEST-lead",
      userId: "TEST-user",
      executiveId: "TEST-exec",
    })).rejects.toThrow("Alerta inválido");
  });
});
