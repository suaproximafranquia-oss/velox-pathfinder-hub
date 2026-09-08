/**
 * E0 COMO ETAPA REAL DA RÉGUA V2.
 * Ligação 1 → 10 minutos → ligação 2 → mensagem (somente se as duas
 * ligações não forem atendidas). Uma ação liberada por vez.
 */
import { describe, expect, it } from "vitest";
import { decideCadenceV2 } from "./cadence-v2-decide";
import { nextReleasedAction, stepActions, waitMinutesOf } from "./cadence-v2";

const base = {
  nowIso: "2026-03-03T13:00:00.000Z",
  flow: "E" as const,
  originDate: "2026-03-03",
  actions: [] as Array<Record<string, unknown>>,
  executedSteps: [] as string[],
  cycle: { materialSent: false },
  stageKey: "em_andamento",
  awaitingHandoff: false,
};

describe("E0 na régua V2", () => {
  it("tem ligação, ligação e mensagem, com 10 minutos entre as ligações", () => {
    const plan = stepActions("E0");
    expect(plan.map((a) => a.kind)).toEqual(["call", "call", "message"]);
    expect(waitMinutesOf(plan[1]!)).toBe(10);
  });

  it("libera a primeira ligação quando não existe nada na fila", () => {
    const decision = decideCadenceV2(base as never);
    expect(decision.kind).toBe("obligation");
    if (decision.kind === "obligation") {
      expect(decision.step).toBe("E0");
      expect(decision.actionKind).toBe("call");
      expect(decision.actionOrder).toBe(1);
    }
  });

  it("nunca libera duas ações do mesmo E0 ao mesmo tempo", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-03-03T12:00:00.000Z",
      states: [{ order: 1, status: "PENDING" }],
    });
    expect(released?.action.order).toBe(1);
  });

  it("a segunda ligação só existe 10 minutos depois da primeira", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-03-03T12:00:00.000Z",
      states: [
        { order: 1, status: "DONE", executedAt: "2026-03-03T12:00:00.000Z" },
        { order: 2, status: "PENDING" },
      ],
    });
    expect(released?.action.order).toBe(2);
    expect(new Date(released!.releaseAt).getTime()).toBeGreaterThanOrEqual(
      Date.parse("2026-03-03T12:10:00.000Z"),
    );
  });

  it("ligação atendida encerra o E0: a mensagem não é cobrada", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-03-03T12:00:00.000Z",
      states: [
        { order: 1, status: "DONE", executedAt: "2026-03-03T12:00:00.000Z" },
        { order: 2, status: "CANCELLED" },
        { order: 3, status: "CANCELLED" },
      ],
      flowChanged: true,
    });
    expect(released).toBeNull();
  });

  it("não recria E0 quando o primeiro contato já foi executado", () => {
    const decision = decideCadenceV2({ ...base, executedSteps: ["E0"] } as never);
    if (decision.kind === "obligation") expect(decision.step).not.toBe("E0");
  });
});
