import { describe, expect, it } from "vitest";
import { decideCadenceV2, type V2DecisionInput } from "./cadence-v2-decide";
import {
  nextTransition,
  planDue,
  theoreticalDateAfterInterval,
  type CadenceV2Step,
  type CycleContext,
} from "./cadence-v2";

const CYCLE: CycleContext = { materialSent: false };

function dateAfter(originDate: string, days: number) {
  return planDue({ originDate, theoreticalOffset: days });
}

describe("semântica única dos intervalos da cadência V2", () => {
  it("regressão: E0 executada na segunda +1 agenda E1 na terça, nunca na quarta", () => {
    const input: V2DecisionInput = {
      nowIso: "2026-09-14T15:00:00.000Z",
      flow: "E",
      originDate: "2026-09-14",
      actions: [
        { step: "E0", actionOrder: 1, actionKind: "call", status: "EXECUTED", dueAt: "2026-09-14T12:00:00.000Z", executedAt: "2026-09-14T15:00:00.000Z", result: "SIM" },
        { step: "E0", actionOrder: 3, actionKind: "message", status: "EXECUTED", dueAt: "2026-09-14T15:00:00.000Z", executedAt: "2026-09-14T15:05:00.000Z", result: "enviado_manual" },
        // Vencimento antigo com interpretação N+1: precisa ser corrigível.
        { step: "E1", actionOrder: 1, actionKind: "call", status: "PENDING", dueAt: "2026-09-16T12:00:00.000Z", executedAt: null, result: null },
      ],
      executedSteps: [],
      cycle: CYCLE,
      stageKey: "zero_contato",
      awaitingHandoff: false,
    };

    expect(decideCadenceV2(input)).toMatchObject({
      kind: "obligation",
      step: "E1",
      dueAt: "2026-09-15T12:00:00.000Z",
      theoreticalDate: "2026-09-15",
    });
  });

  it("E1 executada na terça +2 agenda E2 na quinta", () => {
    expect(dateAfter("2026-09-15", 2)).toMatchObject({
      theoreticalDate: "2026-09-17",
      operationalDate: "2026-09-17",
    });
  });

  it("E2 executada na quinta +2 calcula sábado e só depois desloca para segunda", () => {
    expect(dateAfter("2026-09-17", 2)).toMatchObject({
      theoreticalDate: "2026-09-19",
      operationalDate: "2026-09-21",
      shiftedBy: ["weekend_or_holiday"],
    });
  });

  it.each([
    [3, "2026-09-17"],
    [4, "2026-09-18"],
    [5, "2026-09-19"],
    [7, "2026-09-21"],
  ])("desloca +%i sem acrescentar um dia de espera", (days, expected) => {
    expect(theoreticalDateAfterInterval("2026-09-14", days)).toBe(expected);
  });

  it("quarta +7 resulta na quarta-feira seguinte", () => {
    expect(dateAfter("2026-09-16", 7)).toMatchObject({
      theoreticalDate: "2026-09-23",
      operationalDate: "2026-09-23",
    });
  });

  it("sexta +1 calcula sábado antes de aplicar a política existente", () => {
    expect(dateAfter("2026-09-18", 1)).toMatchObject({
      theoreticalDate: "2026-09-19",
      operationalDate: "2026-09-21",
    });
  });

  it("sábado +1 calcula domingo e usa o deslocamento existente para terça", () => {
    expect(dateAfter("2026-09-19", 1)).toMatchObject({
      theoreticalDate: "2026-09-20",
      operationalDate: "2026-09-22",
    });
  });

  it("preserva os intervalos comerciais existentes de E, R e RE", () => {
    const cases: Array<[CadenceV2Step, CadenceV2Step, number, CycleContext]> = [
      ["E0", "E1", 1, CYCLE],
      ["E1", "E2", 2, CYCLE],
      ["E4", "E7", 3, CYCLE],
      ["E5", "E6", 7, CYCLE],
      ["R3", "R5", 4, CYCLE],
      ["RE0", "RE1", 1, CYCLE],
      ["RE2", "RE3", 5, CYCLE],
      ["RE3", "RE4", 7, CYCLE],
    ];
    for (const [from, to, days, cycle] of cases) {
      expect(nextTransition(from, cycle)).toMatchObject({ to, days });
    }
  });

  it("planDue e o resolvedor central produzem a mesma data teórica", () => {
    for (const days of [1, 2, 3, 4, 5, 7]) {
      expect(dateAfter("2026-09-16", days).theoreticalDate).toBe(
        theoreticalDateAfterInterval("2026-09-16", days),
      );
    }
  });
});