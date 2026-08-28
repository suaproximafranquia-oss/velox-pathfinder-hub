import { describe, it, expect, beforeEach } from "vitest";
import { emitEvent, listEvents, clearEvents, type PortalEvent } from "@/lib/events/bus";
import { filterInvestorActivity } from "@/lib/events/investor-activity";

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

function activityOf(investorId: string): string | null {
  const list = filterInvestorActivity(listEvents({ investorId }));
  return list.length ? list.map((e) => e.at).sort().at(-1)! : null;
}

describe("atividade real do investidor", () => {
  beforeEach(() => {
    store.clear();
  });

  it("ignora ações administrativas do executivo", () => {
    const admin: PortalEvent["type"][] = [
      "lead.status.changed",
      "profile.updated",
      "meeting.created",
      "meeting.confirmed",
      "meeting.rescheduled",
      "investor.reactivated",
      "admin.settings.updated",
    ];
    for (const type of admin) emitEvent({ type, investorId: "L1" });
    expect(activityOf("L1")).toBeNull();
  });

  it("reconhece atividade real do investidor", () => {
    emitEvent({ type: "profile.updated", investorId: "L2" });
    emitEvent({ type: "manual.chapter.completed", investorId: "L2", at: "2026-08-27T10:00:00.000Z" });
    expect(activityOf("L2")).toBe("2026-08-27T10:00:00.000Z");
  });

  it("meeting.requested conta apenas quando parte do investidor", () => {
    emitEvent({ type: "meeting.requested", investorId: "L3", payload: { origin: "executivo" } });
    expect(activityOf("L3")).toBeNull();
    emitEvent({ type: "meeting.requested", investorId: "L3", payload: { origin: "investidor" } });
    expect(activityOf("L3")).not.toBeNull();
  });
});

describe("deduplicação do barramento", () => {
  beforeEach(() => {
    store.clear();
    clearEvents();
  });

  it("descarta emissão equivalente na mesma janela", () => {
    emitEvent({ type: "lead.status.changed", investorId: "L4", dedupeKey: "k" });
    emitEvent({ type: "lead.status.changed", investorId: "L4", dedupeKey: "k" });
    expect(listEvents({ investorId: "L4" })).toHaveLength(1);
  });

  it("preserva eventos legítimos distintos", () => {
    emitEvent({ type: "lead.status.changed", investorId: "L5", dedupeKey: "a" });
    emitEvent({ type: "lead.status.changed", investorId: "L5", dedupeKey: "b" });
    emitEvent({ type: "manual.completed", investorId: "L5" });
    emitEvent({ type: "manual.completed", investorId: "L5" });
    expect(listEvents({ investorId: "L5" })).toHaveLength(4);
  });
});
