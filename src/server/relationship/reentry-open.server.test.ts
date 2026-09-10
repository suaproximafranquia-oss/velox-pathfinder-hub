import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>, tick: vi.fn(), closeE0: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: (table: string) => {
    let filters: ((r: any) => boolean)[] = [];
    let change: any = null; let insert: any = null; let upsert: any = null;
    let sort: string | null = null; let cap = Infinity;
    const execute = () => {
      const all = db.tables[table] ?? (db.tables[table] = []);
      if (insert) {
        if (table === "relationship_cadences" && all.some((r) => r.id === insert.id || r.active || r.instance_seq === insert.instance_seq)) return { data: null, error: { code: "23505" } };
        all.push({ created_at: "2026-09-09T12:00:00Z", ...insert });
      }
      if (upsert && !all.some((r) => r.event_key === upsert.event_key)) all.push(upsert);
      const rows = all.filter((r) => filters.every((f) => f(r)));
      if (change) rows.forEach((r) => Object.assign(r, change));
      if (sort) rows.sort((a, b) => b[sort!] - a[sort!]);
      return { data: rows.slice(0, cap), error: null };
    };
    const q = {
      select: () => q,
      eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return q; },
      is: (k: string, v: any) => { filters.push((r) => (r[k] ?? null) === v); return q; },
      in: (k: string, v: any[]) => { filters.push((r) => v.includes(r[k])); return q; },
      lt: (k: string, v: any) => { filters.push((r) => r[k] < v); return q; },
      lte: (k: string, v: any) => { filters.push((r) => r[k] <= v); return q; },
      order: (k: string) => { sort = k; return q; }, limit: (n: number) => { cap = n; return q; },
      update: (row: any) => { change = row; return q; },
      insert: (row: any) => { insert = row; return q; },
      upsert: (row: any) => { upsert = row; return q; },
      maybeSingle: async () => { const r = execute(); return { ...r, data: r.data?.[0] ?? null }; },
      then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
    }; return q;
  },
} }));
vi.mock("./flow-versions.server", () => ({ getPublishedVersion: async () => ({ id: "TEST-version", version: 1 }) }));
vi.mock("./engine.server", () => ({ productionEngine: () => ({ tick: db.tick }) }));
vi.mock("@/server/crm/e0-actions.server", () => ({ closePendingE0Actions: db.closeE0 }));
import { openCommercialReentry } from "./reentry-open.server";
const input = { leadId: "TEST-reentry", submissionKey: "portal:TEST-submission", at: "2026-09-09T12:00:00Z" };
beforeEach(() => {
  db.tick.mockReset(); db.closeE0.mockReset();
  db.tables = {
    portal_leads: [{ id: input.leadId, scope: "portal", origin: "Portal Velox" }],
    relationship_cadences: [{ id: "TEST-old", lead_id: input.leadId, instance_seq: 1, active: true, scope: "production", started_at: "2026-09-01T12:00:00Z" }],
    relationship_queue: [
      { id: "TEST-history", lead_id: input.leadId, scope: "production", action_order: 1, status: "EXECUTED", result: "NAO", created_at: "2026-09-01T12:00:00Z" },
      { id: "TEST-pending", lead_id: input.leadId, scope: "production", action_order: 2, status: "PENDING", created_at: "2026-09-01T12:00:00Z" },
    ],
  };
});
it("abre somente RE0, preserva o resultado antigo e repetir não cria outro ciclo", async () => {
  const historical = { ...db.tables.relationship_queue[0] };
  await openCommercialReentry(input);
  await openCommercialReentry(input);
  expect(db.tables.relationship_cadences).toHaveLength(2);
  expect(db.tables.relationship_cadences.filter((r) => r.active)).toHaveLength(1);
  expect(db.tables.relationship_cadences[1]).toMatchObject({ flow: "reentrada", current_step: "RE0", instance_seq: 2 });
  expect(db.tables.relationship_queue[0]).toEqual(historical);
  expect(db.tables.relationship_queue[1].status).toBe("CANCELLED");
  expect(db.tables.relationship_events).toHaveLength(1);
  expect(db.tick).toHaveBeenCalledWith(input.leadId);
});
it("duas aberturas concorrentes da mesma submissão convergem para um ciclo", async () => {
  await Promise.all([openCommercialReentry(input), openCommercialReentry(input)]);
  expect(db.tables.relationship_cadences).toHaveLength(2);
  expect(db.tables.relationship_cadences.filter((r) => r.active)).toHaveLength(1);
  expect(db.tables.relationship_events).toHaveLength(1);
});
it("retry após falha do tick reaproveita instância e preserva sua fila", async () => {
  db.tick.mockRejectedValueOnce(new Error("TEST falha transitória"));
  await expect(openCommercialReentry(input)).rejects.toThrow("transitória");
  const current = { id: "TEST-new-queue", lead_id: input.leadId, scope: "production", action_order: 201, status: "PENDING", created_at: input.at };
  db.tables.relationship_queue.push(current);
  await openCommercialReentry(input);
  expect(current.status).toBe("PENDING");
  expect(db.tables.relationship_cadences).toHaveLength(2);
});
it("nova submissão posterior cria próxima RE sem reabrir submissão anterior", async () => {
  await openCommercialReentry(input);
  await openCommercialReentry({ ...input, submissionKey: "portal:TEST-next", at: "2026-09-10T12:00:00Z" });
  await openCommercialReentry(input);
  expect(db.tables.relationship_cadences).toHaveLength(3);
  expect(db.tables.relationship_cadences.filter((r) => r.active)[0]).toMatchObject({ instance_seq: 3, current_step: "RE0" });
});
it("não abre RE para outra unidade, data inválida ou entrada anterior", async () => {
  expect(await openCommercialReentry({ ...input, at: "invalid" })).toBe(false);
  expect(await openCommercialReentry({ ...input, at: "2026-08-01T12:00:00Z" })).toBe(false);
  db.tables.portal_leads[0].origin = "Velox Solar";
  expect(await openCommercialReentry(input)).toBe(false);
  expect(db.tables.relationship_cadences).toHaveLength(1);
  expect(db.tick).not.toHaveBeenCalled();
});