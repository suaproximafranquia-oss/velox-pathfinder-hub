import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ card: null as any, writes: [] as any[] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => {
    let patch: any;
    const q: any = { select: () => q, eq: () => q, is: () => q,
      maybeSingle: async () => ({ data: fake.card, error: null }),
      update: (p: any) => { patch = p; return q; },
      then: (resolve: any) => { fake.writes.push(patch); return Promise.resolve({ error: null }).then(resolve); },
    }; return q;
  },
} }));
vi.mock("./manager-guard.server", () => ({ isManagementExecutive: vi.fn() }));
vi.mock("./lead-service.server", () => ({ sanitizeRawPayload: (v: any) => v }));
import { refreshWorkspaceCardName } from "./workspace-card.server";
beforeEach(() => { fake.card = { id: "gs_TEST", name: "Antigo", manual_overrides: {}, responsible_executive_id: "TEST-owner" }; fake.writes = []; });
it("GreenSales atualiza exclusivamente nome do mesmo card", async () => {
  await refreshWorkspaceCardName("TEST", "Nome oficial");
  expect(fake.writes).toEqual([{ name: "Nome oficial" }]);
});
it("respeita manual_overrides e não cria card ausente", async () => {
  fake.card.manual_overrides = { name: { locked: true } };
  await refreshWorkspaceCardName("TEST", "Nome oficial");
  fake.card = null;
  await refreshWorkspaceCardName("TEST", "Nome oficial");
  expect(fake.writes).toEqual([]);
});