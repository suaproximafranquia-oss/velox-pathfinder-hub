import { describe, expect, it } from "vitest";
import { decideCadenceV2, type V2DecisionInput, type V2QueueAction } from "./cadence-v2-decide";
import { nextTransition, stepActions } from "./cadence-v2";

const firstAt = "2026-09-09T13:00:00.000Z";
const first: V2QueueAction = { step: "E1", actionOrder: 1, actionKind: "call", status: "EXECUTED", dueAt: firstAt, executedAt: firstAt, result: "NAO" };
const message: V2QueueAction = { ...first, actionOrder: 3, actionKind: "message", executedAt: "2026-09-09T13:01:00.000Z", result: "enviado_manual" };
const input = (actions: V2QueueAction[]): V2DecisionInput => ({ nowIso: firstAt, originDate: "2026-09-08", flow: "E", actions, executedSteps: ["E0"], cycle: { materialSent: false }, stageKey: "em_andamento", awaitingHandoff: false });

describe("E1/E2 — uma ligação e uma mensagem", () => {
  it("E1 libera a mensagem após a única ligação e nunca planeja outra ligação", () => {
    expect(decideCadenceV2(input([first]))).toMatchObject({ step: "E1", actionOrder: 3, actionKind: "message", dueAt: firstAt });
    expect(stepActions("E1").filter((action) => action.kind === "call")).toHaveLength(1);
  });

  it("histórico antigo da segunda ligação E1 não cria compensação em E2", () => {
    const historicalSecond: V2QueueAction = { ...first, actionOrder: 2, status: "CANCELLED", executedAt: null, cancelReason: "additional_call_day_expired" };
    const afterE1 = input([first, message, historicalSecond]);
    expect(decideCadenceV2(afterE1)).toMatchObject({ step: "E2", dueAt: "2026-09-11T12:00:00.000Z" });
    const e2first = { ...first, step: "E2", dueAt: "2026-09-11T12:00:00.000Z", executedAt: "2026-09-11T12:00:00.000Z" };
    const e2 = input([...afterE1.actions, e2first]);
    expect(decideCadenceV2(e2)).toMatchObject({ step: "E2", actionOrder: 2, actionKind: "message", dueAt: e2first.executedAt });
    expect(stepActions("E2").filter((action) => action.kind === "call")).toHaveLength(1);
  });

  it("E1 e E2 seguem para as etapas seguintes nas mesmas datas", () => {
    expect(nextTransition("E1", { materialSent: false })).toEqual({ to: "E2", days: 2 });
    expect(nextTransition("E2", { materialSent: false })).toEqual({ to: "E3", days: 2 });
    expect(stepActions("E3").filter((action) => action.kind === "call")).toHaveLength(1);
  });
});