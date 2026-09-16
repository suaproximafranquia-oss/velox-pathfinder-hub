import { describe, expect, it } from "vitest";
import { decideCadenceV2, type V2DecisionInput, type V2QueueAction } from "./cadence-v2-decide";
import {
  isNeutralizedCadenceCancellation,
  NEGOTIATION_CLOSED_CANCEL_REASON,
  supportsWorkspaceCadenceControl,
} from "./lead-cadence-closure";

const NOW = "2026-09-16T13:00:00.000Z";

function action(
  step: string,
  status: string,
  actionOrder = 1,
  actionKind: "call" | "message" = "message",
): V2QueueAction {
  return {
    step,
    actionOrder,
    actionKind,
    status,
    dueAt: NOW,
    executedAt: status === "EXECUTED" ? NOW : null,
    result: status === "EXECUTED" && actionKind === "call" ? "NAO" : null,
    cancelReason: status === "CANCELLED" ? NEGOTIATION_CLOSED_CANCEL_REASON : null,
  };
}

function input(actions: V2QueueAction[], closed = false): V2DecisionInput {
  return {
    nowIso: NOW,
    flow: "E",
    originDate: "2026-09-16",
    actions: actions.filter(
      (row) => !isNeutralizedCadenceCancellation(row.status, row.cancelReason),
    ),
    executedSteps: [],
    cycle: {
      materialSent: false,
      materialRequested: false,
      needsNewPresentation: false,
      materialRequestedInCycle: false,
      materialSentInCycle: false,
      visualPath: false,
      reachedE4Historically: false,
    },
    stageKey: null,
    hasCommitment: false,
    awaitingHandoff: false,
    closed,
  };
}

function nextStep(actions: V2QueueAction[]): string | null {
  const decision = decideCadenceV2(input(actions));
  return decision.kind === "obligation" ? decision.step : null;
}

describe("Encerrar/Reabrir integrado à régua V2", () => {
  it("A — Portal com E0 não executada retoma E0", () => {
    expect(nextStep([action("E0", "CANCELLED", 1, "call")])).toBe("E0");
  });

  it("B — Portal com E0 executada retoma E1", () => {
    expect(nextStep([action("E0", "EXECUTED", 1, "call")])).toBe("E1");
  });

  it("C — TikTok com E1 não executada retoma E1", () => {
    expect(nextStep([
      action("E0", "EXECUTED", 1, "call"),
      action("E1", "CANCELLED", 1, "call"),
    ])).toBe("E1");
  });

  it("D — Meta com E1 executada retoma E2", () => {
    expect(nextStep([
      action("E0", "EXECUTED", 1, "call"),
      action("E1", "EXECUTED", 1, "call"),
    ])).toBe("E2");
  });

  it("E — E2 executada e E3 não executada retoma E3", () => {
    expect(nextStep([
      action("E0", "EXECUTED", 1, "call"),
      action("E1", "EXECUTED", 1, "call"),
      action("E2", "EXECUTED", 1, "call"),
      action("E3", "CANCELLED", 1, "call"),
    ])).toBe("E3");
  });

  it("F — E3 executada retoma E4", () => {
    expect(nextStep([
      action("E0", "EXECUTED", 1, "call"),
      action("E1", "EXECUTED", 1, "call"),
      action("E2", "EXECUTED", 1, "call"),
      action("E3", "EXECUTED", 1, "call"),
    ])).toBe("E4");
  });

  it("G — ação pulada permanece pendente e não avança", () => {
    expect(nextStep([
      action("E0", "EXECUTED", 1, "call"),
      action("E1", "PENDING", 1, "call"),
    ])).toBe("E1");
  });

  it("H/I — encerramento impede obrigação em reconciliação ou reload", () => {
    expect(decideCadenceV2(input([], true))).toMatchObject({ kind: "none" });
    expect(decideCadenceV2(input([action("E0", "CANCELLED", 1, "call")], true))).toMatchObject({ kind: "none" });
  });

  it("J/K — reabertura repetida decide uma única chave coerente", () => {
    const actions = [action("E0", "EXECUTED", 1, "call")];
    const first = decideCadenceV2(input(actions));
    const repeated = decideCadenceV2(input(actions));
    expect(first).toMatchObject({ kind: "obligation", step: "E1", actionOrder: 1 });
    expect(repeated).toEqual(first);
  });

  it("L — EXECUTED permanece decisivo e nunca é neutralizado", () => {
    expect(isNeutralizedCadenceCancellation("EXECUTED", NEGOTIATION_CLOSED_CANCEL_REASON)).toBe(false);
    expect(nextStep([action("E0", "EXECUTED", 1, "call")])).toBe("E1");
  });

  it("M — somente Portal, TikTok e Meta recebem o novo controle", () => {
    expect(supportsWorkspaceCadenceControl("portal")).toBe(true);
    expect(supportsWorkspaceCadenceControl("tiktok")).toBe(true);
    expect(supportsWorkspaceCadenceControl("meta")).toBe(true);
    expect(supportsWorkspaceCadenceControl("green_sales")).toBe(false);
    expect(supportsWorkspaceCadenceControl("redistribuicao")).toBe(false);
  });
});