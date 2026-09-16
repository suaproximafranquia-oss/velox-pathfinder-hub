import { describe, expect, it } from "vitest";
import { decideCadenceV2, type V2DecisionInput, type V2QueueAction } from "./cadence-v2-decide";
import {
  nextReleasedAction,
  nextTransition,
  stepActions,
  type CadenceV2Flow,
  type CadenceV2Step,
} from "./cadence-v2";
import { resolvePostCallLibraryStep } from "./post-call-message";

const NOW = "2026-09-16T13:00:00.000Z";
const COMPOSED_STEPS = ["E0", "E1", "E2", "E3", "E4", "E7", "R1", "R2", "RE0", "RE1", "RE3"] as const;

const PREVIOUS_STEPS: Record<(typeof COMPOSED_STEPS)[number], string[]> = {
  E0: [],
  E1: ["E0"],
  E2: ["E0", "E1"],
  E3: ["E0", "E1", "E2"],
  E4: ["E0", "E1", "E2", "E3"],
  E7: ["E0", "E1", "E2", "E3", "E4"],
  R1: [],
  R2: ["R1"],
  RE0: [],
  RE1: ["RE0"],
  RE3: ["RE0", "RE1", "RE2"],
};

function flowOf(step: CadenceV2Step): CadenceV2Flow {
  if (step.startsWith("RE")) return "RE";
  if (step.startsWith("R")) return "R";
  return "E";
}

function rowsFor(step: (typeof COMPOSED_STEPS)[number], messageStatus: "PENDING" | "EXECUTED"): V2QueueAction[] {
  const plan = stepActions(step);
  const callOrder = plan.find((action) => action.kind === "call")?.order;
  const messageOrder = plan.find((action) => action.kind === "message")?.order;
  if (callOrder == null || messageOrder == null) throw new Error(`Etapa composta inválida: ${step}`);
  return [
    { step, actionOrder: callOrder, actionKind: "call", status: "EXECUTED", dueAt: NOW, executedAt: NOW, result: "SIM" },
    { step, actionOrder: messageOrder, actionKind: "message", status: messageStatus, dueAt: NOW, executedAt: messageStatus === "EXECUTED" ? NOW : null, result: messageStatus === "EXECUTED" ? "enviado_manual" : null },
  ];
}

function inputFor(step: (typeof COMPOSED_STEPS)[number], messageStatus: "PENDING" | "EXECUTED"): V2DecisionInput {
  return {
    nowIso: NOW,
    flow: flowOf(step),
    originDate: "2026-09-16",
    actions: rowsFor(step, messageStatus),
    executedSteps: PREVIOUS_STEPS[step],
    cycle: { materialSent: false },
    stageKey: step.startsWith("R") && !step.startsWith("RE") ? "frio" : "zero_contato",
    awaitingHandoff: false,
  };
}

describe.each(COMPOSED_STEPS)("%s — ligação e mensagem na mesma etapa", (step) => {
  it("SIM libera imediatamente a mensagem da mesma etapa", () => {
    const plan = stepActions(step);
    const call = plan.find((action) => action.kind === "call");
    const message = plan.find((action) => action.kind === "message");
    if (!call || !message) throw new Error(`Etapa composta inválida: ${step}`);
    const released = nextReleasedAction({
      step,
      stepDueAt: NOW,
      operationalDate: "2026-09-16",
      states: [{ order: call.order, status: "DONE", executedAt: NOW, result: "SIM" }],
    });
    expect(released).toMatchObject({ action: { order: message.order, kind: "message" }, releaseAt: NOW });
  });

  it("não conclui a etapa enquanto a mensagem está pendente", () => {
    expect(decideCadenceV2(inputFor(step, "PENDING"))).toMatchObject({
      kind: "obligation",
      step,
      actionKind: "message",
    });
  });

  it("só avança depois que ligação e mensagem estão executadas", () => {
    const decision = decideCadenceV2(inputFor(step, "EXECUTED"));
    const transition = nextTransition(step, { materialSent: false });
    if (transition) expect(decision).toMatchObject({ kind: "obligation", step: transition.to });
    else expect(decision).toMatchObject({ kind: "none" });
  });

  it("preserva a mensagem específica da etapa após NÃO ATENDEU", () => {
    expect(resolvePostCallLibraryStep(step, "NAO")).toBe(step);
  });
});