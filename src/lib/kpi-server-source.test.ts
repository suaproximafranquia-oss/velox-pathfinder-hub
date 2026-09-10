import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  scope: { role: "user", selfExecutiveId: "TEST-a", canUseConsolidated: false, collaborators: [{ id: "TEST-a", name: "A" }] },
  queries: [] as any[], rows: [
    { executive_id: "TEST-a", month_key: "2026-07", indicator_id: "salesValue", day: 1, value: 30000, updated_at: "2026-09-01" },
    { executive_id: "TEST-b", month_key: "2026-07", indicator_id: "salesValue", day: 1, value: 15000, updated_at: "2026-09-01" },
    { executive_id: "TEST-a", month_key: "2026-07", indicator_id: "contractsSigned", day: 1, value: 2, updated_at: "2026-09-01" },
  ],
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const c: any = { middleware: () => c, inputValidator: () => c, handler: (fn: any) => fn }; return c;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/server/kpi/kpi-scope.server", () => ({ resolveKpiScope: async () => fake.scope,
  readableExecutiveIds: (scope: any, id: string | null) => scope.collaborators.map((c: any) => c.id).filter((v: string) => !id || v === id),
}));
vi.mock("@/server/operational-team.server", () => ({ listActiveOperationalExecutives: async () => [{ id: "TEST-a", name: "A" }, { id: "TEST-b", name: "B" }] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const filters: any[] = []; fake.queries.push({ table, filters });
  const q: any = { select: () => q, order: () => q, range: () => q,
    eq: (k: string, v: any) => { filters.push([k, [v]]); return q; },
    in: (k: string, v: any[]) => { filters.push([k, v]); return q; },
    then: (resolve: any) => Promise.resolve({ data: fake.rows.filter((row: any) => filters.every(([k, v]) => v.includes(row[k]))), error: null }).then(resolve),
  }; return q;
} } }));
import { lerKpiMes, lerKpiBrain, lerVendasCampanhas } from "./kpi-data.functions";
const context = { userId: "TEST-auth", supabase: {} };
beforeEach(() => { fake.queries = []; });
it("Brain e KPI individual devolvem as mesmas células do recorte autorizado", async () => {
  const kpi = await (lerKpiMes as any)({ context, data: { monthKey: "2026-07", executiveId: "TEST-a" } });
  const brain = await (lerKpiBrain as any)({ context, data: { monthKeys: ["2026-07"], executiveId: null } });
  expect(brain.months["2026-07"].cells).toEqual(kpi.cells);
  expect(fake.queries.every((q) => q.table === "kpi_entries")).toBe(true);
});
it("Brain rejeita executivo fora do escopo; campanha corporativa limita projeção a vendas", async () => {
  await expect((lerKpiBrain as any)({ context, data: { monthKeys: ["2026-07"], executiveId: "TEST-b" } })).rejects.toThrow("escopo");
  const campaign = await (lerVendasCampanhas as any)({ context, data: { monthKey: "2026-07" } });
  expect(campaign.datasets["TEST-a"].cells[0].value).toBe(30000);
  expect(campaign.datasets["TEST-b"].cells[0].value).toBe(15000);
  expect(campaign.readableReportIds).toEqual(["TEST-a"]);
  expect(fake.queries.at(-1).filters).toContainEqual(["indicator_id", ["salesValue", "contractsSigned"]]);
});