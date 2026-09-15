import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let cap = Number.POSITIVE_INFINITY;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push((row: Record<string, unknown>) => row[key] === value);
          return query;
        },
        limit: (value: number) => {
          cap = value;
          return query;
        },
        then: (resolve: (value: { data: Array<Record<string, unknown>> }) => unknown) =>
          Promise.resolve({ data: db.rows.filter((row) => filters.every((filter) => filter(row))).slice(0, cap) }).then(resolve),
      };
      return query;
    },
  },
}));

import { resolveStepContextForLead } from "./cadence-v2-state.server";

const call = (actionOrder: number, result: "SIM" | "NAO", status = "EXECUTED") => ({
  scope: "production",
  lead_id: "TEST-E0",
  step: "E0",
  action_kind: "call",
  action_order: actionOrder,
  status,
  result,
});

describe("E0 — contexto persistido pelo desfecho da ligação", () => {
  beforeEach(() => {
    db.rows = [];
  });

  it("A) SIM na primeira ligação resolve CONTATO_REALIZADO", async () => {
    db.rows = [call(1, "SIM")];
    await expect(resolveStepContextForLead("TEST-E0", "E0")).resolves.toBe("CONTATO_REALIZADO");
  });

  it("D) SIM nunca resolve SEM_CONTATO", async () => {
    db.rows = [call(1, "SIM"), call(2, "NAO")];
    await expect(resolveStepContextForLead("TEST-E0", "E0")).resolves.not.toBe("SEM_CONTATO");
  });

  it("E) somente NAO resolve SEM_CONTATO", async () => {
    db.rows = [call(1, "NAO"), call(2, "NAO")];
    await expect(resolveStepContextForLead("TEST-E0", "E0")).resolves.toBe("SEM_CONTATO");
  });

  it("F) SIM na segunda ligação também resolve CONTATO_REALIZADO", async () => {
    db.rows = [call(1, "NAO"), call(2, "SIM")];
    await expect(resolveStepContextForLead("TEST-E0", "E0")).resolves.toBe("CONTATO_REALIZADO");
  });

  it("G) reload ignora ações não executadas e preserva o SIM executado", async () => {
    db.rows = [call(1, "NAO"), call(2, "SIM"), call(3, "NAO", "PENDING")];
    await expect(resolveStepContextForLead("TEST-E0", "E0")).resolves.toBe("CONTATO_REALIZADO");
  });

  it("H) não usa SIM de outra etapa, lead ou ambiente", async () => {
    db.rows = [
      { ...call(1, "SIM"), step: "E1" },
      { ...call(1, "SIM"), lead_id: "TEST-OUTRO" },
      { ...call(1, "SIM"), scope: "homologation" },
    ];
    await expect(resolveStepContextForLead("TEST-E0", "E0")).resolves.toBe("SEM_CONTATO");
  });
});