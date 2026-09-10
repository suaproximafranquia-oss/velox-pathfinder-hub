import { expect, it, vi } from "vitest";
import { datasetFromCells } from "./kpi-dataset";
import { summarize } from "./kpi-manager";
import { buildCampaignRows } from "@/components/executive/kpi/painel-campanhas";
import { buildOperationalSnapshot } from "./brain-data";
import { buildBrainAnalytics } from "./brain-analytics";
import type { ExecutiveSession, ExecutiveUser } from "./executive-auth";

it("KPI, Campanhas e Brain usam as mesmas células oficiais e mantêm dinheiro separado de unidades", () => {
  const getItem = vi.fn(() => { throw new Error("localStorage não permitido"); });
  vi.stubGlobal("window", { localStorage: { getItem } });
  try {
    const key = "2026-07";
    const ds = datasetFromCells("TEST-exec", key, { updatedAt: 1, cells: [
      { indicatorId: "salesValue", day: 1, value: 30000 },
      { indicatorId: "salesValue", day: 2, value: 15000 },
      { indicatorId: "contractsSigned", day: 1, value: 3 },
    ] });
    const session = { userId: "TEST-exec", name: "Teste", activeRole: "executivo" } as ExecutiveSession;
    const scope = { mode: "executive" as const, executiveId: session.userId };
    const users = [{ id: session.userId, name: session.name }] as ExecutiveUser[];
    expect(summarize(ds)).toMatchObject({ salesValue: 45000, sales: 3 });
    expect(buildCampaignRows(users, { [session.userId]: ds })[0]).toMatchObject({ value: 45000, units: 3 });
    const snapshot = buildOperationalSnapshot(session, scope, key, [ds]);
    expect(snapshot.funnel.find((r) => r.id === "revenue")?.value).toBe(45000);
    expect(snapshot.funnel.find((r) => r.id === "sales")?.value).toBe(3);
    const analytics = buildBrainAnalytics(session, scope, key, { [key]: [ds] }, users);
    expect(analytics.comparison.rows.find((r) => r.id === "salesValue")).toMatchObject({ current: 45000, annualAverage: 7500, unit: "currency" });
    expect(analytics.comparison.rows.find((r) => r.id === "sales")).toMatchObject({ current: 3, unit: "count" });
    expect(getItem).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});