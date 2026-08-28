/**
 * CENÁRIOS 1–12 do COMANDO A — derivação do estado operacional do Lead.
 * A fonte de verdade é o registro do servidor (viewed_at / closed_at) e a
 * atividade REAL do investidor; nenhuma ação administrativa muda o estado.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = { id: string; viewedAt?: string | null; closedAt?: string | null };
const rows: Row[] = [];

vi.mock("@/lib/leads", () => ({
  loadLeads: () => rows,
  patchCachedLead: () => undefined,
}));
vi.mock("@/lib/workspace-operational.functions", () => ({
  updateWorkspaceOperational: () => Promise.resolve({ updated: 1 }),
}));
vi.mock("@/lib/sync-bus", () => ({ notifySync: () => undefined }));

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

const { resolveLeadState } = await import("@/lib/lead-state");
const { emitEvent, listEvents, clearEvents } = await import("@/lib/events/bus");
const { filterInvestorActivity } = await import("@/lib/events/investor-activity");

/** Reproduz o cálculo do Workspace: lastActivity = só atividade real. */
function lastActivity(id: string): string | undefined {
  const list = filterInvestorActivity(listEvents({ investorId: id }));
  return list.map((e) => e.at).sort().at(-1);
}
function stateOf(id: string) {
  return resolveLeadState({ id, lastActivity: lastActivity(id) });
}

const VIEWED = "2026-08-27T12:00:00.000Z";

describe("estado operacional do lead", () => {
  beforeEach(() => {
    rows.length = 0;
    store.clear();
    clearEvents();
  });

  it("C1 — lead novo permanece NOVO", () => {
    rows.push({ id: "L1" });
    expect(stateOf("L1")).toBe("novo");
  });

  it("C2/C3/C4 — visualizado fica EM ANDAMENTO e assim permanece", () => {
    rows.push({ id: "L2", viewedAt: VIEWED });
    expect(stateOf("L2")).toBe("em_andamento");
    expect(stateOf("L2")).toBe("em_andamento"); // remontagem / F5
  });

  it("C5–C9 — ações administrativas não devolvem o lead para NOVO", () => {
    rows.push({ id: "L3", viewedAt: VIEWED });
    const admin = [
      "profile.updated",
      "meeting.created",
      "meeting.rescheduled",
      "investor.reactivated",
      "admin.settings.updated",
      "lead.status.changed",
    ] as const;
    for (const type of admin) {
      emitEvent({ type, investorId: "L3", at: "2026-08-27T18:00:00.000Z" });
      expect(stateOf("L3")).toBe("em_andamento");
    }
  });

  it("C10 — repetição por montagem não gera tempestade de eventos", () => {
    for (let i = 0; i < 5; i += 1) {
      emitEvent({
        type: "lead.status.changed",
        investorId: "L4",
        dedupeKey: "lead.status.changed:L4:em_andamento",
      });
    }
    expect(listEvents({ investorId: "L4" })).toHaveLength(1);
  });

  it("C11 — atividade real posterior ao viewed_at volta para NOVO", () => {
    rows.push({ id: "L5", viewedAt: VIEWED });
    emitEvent({
      type: "manual.chapter.completed",
      investorId: "L5",
      at: "2026-08-27T18:30:00.000Z",
    });
    expect(stateOf("L5")).toBe("novo");
  });

  it("C12 — lead encerrado permanece ENCERRADO", () => {
    rows.push({ id: "L6", viewedAt: VIEWED, closedAt: "2026-08-27T19:00:00.000Z" });
    emitEvent({ type: "manual.completed", investorId: "L6", at: "2026-08-27T20:00:00.000Z" });
    expect(stateOf("L6")).toBe("encerrado");
  });
});
