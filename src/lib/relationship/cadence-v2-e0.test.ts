/**
 * E0 COMO ETAPA REAL DA RÉGUA V2.
 * Ligação 1 → 10 minutos → ligação 2 → mensagem (somente se as duas
 * ligações não forem atendidas). Uma ação liberada por vez.
 */
import { describe, expect, it } from "vitest";
import { decideCadenceV2 } from "./cadence-v2-decide";
import {
  e0OperationalDate,
  e0StructureDate,
  nextReleasedAction,
  stepActions,
  waitMinutesOf,
} from "./cadence-v2";

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
  it("A–E) congela a data operacional pela entrada real", () => {
    expect(e0OperationalDate("2026-09-14T13:00:00.000Z")).toBe("2026-09-14");
    expect(e0OperationalDate("2026-09-14T21:00:00.000Z")).toBe("2026-09-15");
    expect(e0OperationalDate("2026-09-18T21:00:00.000Z")).toBe("2026-09-21");
    expect(e0OperationalDate("2026-09-19T05:00:00.000Z")).toBe("2026-09-21");
    expect(e0OperationalDate("2026-09-20T18:00:00.000Z")).toBe("2026-09-21");
  });

  it("F–H) atraso não muda a estrutura original da E0", () => {
    expect(e0StructureDate("2026-09-14", "2026-09-15T15:00:00.000Z", [])).toBe("2026-09-14");
    expect(stepActions("E0", false, "2026-09-14").map((action) => action.kind)).toEqual(["call", "message"]);
    expect(e0StructureDate("2026-09-15", "2026-09-16T15:00:00.000Z", [])).toBe("2026-09-15");
    expect(stepActions("E0", false, "2026-09-15").map((action) => action.kind)).toEqual(["call", "call", "message"]);
    expect(e0StructureDate("2026-09-18", "2026-09-21T15:00:00.000Z", [])).toBe("2026-09-18");
    expect(stepActions("E0", false, "2026-09-18").map((action) => action.kind)).toEqual(["call", "call", "message"]);
  });

  it("I–J) entrada do fim de semana usa segunda e não muda depois de iniciada", () => {
    const monday = e0OperationalDate("2026-09-19T12:00:00.000Z");
    expect(stepActions("E0", false, monday).map((action) => action.kind)).toEqual(["call", "message"]);
    expect(e0StructureDate("2026-09-21", "2026-09-22T15:00:00.000Z", [
      { order: 1, status: "DONE", executedAt: "2026-09-19T12:00:00.000Z", result: "NAO" },
    ])).toBe("2026-09-21");
  });

  it("separa sexta antes do corte das entradas acumuladas para segunda", () => {
    const fridayBeforeCutoff = e0OperationalDate("2026-09-18T19:59:59.000Z");
    const fridayAtCutoff = e0OperationalDate("2026-09-18T21:00:00.000Z");
    const saturday = e0OperationalDate("2026-09-19T15:00:00.000Z");
    const sunday = e0OperationalDate("2026-09-20T15:00:00.000Z");
    expect(fridayBeforeCutoff).toBe("2026-09-18");
    expect(stepActions("E0", false, fridayBeforeCutoff).map((action) => action.kind)).toEqual(["call", "call", "message"]);
    for (const accumulated of [fridayAtCutoff, saturday, sunday]) {
      expect(accumulated).toBe("2026-09-21");
      expect(stepActions("E0", false, accumulated).map((action) => action.kind)).toEqual(["call", "message"]);
    }
    expect(stepActions("E1", false, fridayBeforeCutoff).map((action) => action.kind)).toEqual(["call", "message"]);
    expect(stepActions("E2", false, fridayBeforeCutoff).map((action) => action.kind)).toEqual(["call", "message"]);
    expect(stepActions("RE0", false, fridayBeforeCutoff).map((action) => action.kind)).toEqual(["message"]);
  });
  it("tem ligação, ligação e mensagem, com 10 minutos entre as ligações", () => {
    const plan = stepActions("E0");
    expect(plan.map((a) => a.kind)).toEqual(["call", "call", "message"]);
    expect(waitMinutesOf(plan[1]!)).toBe(10);
  });

  it("na segunda-feira tem somente uma ligação seguida da mensagem", () => {
    const plan = stepActions("E0", false, "2026-09-14");
    expect(plan.map((a) => `${a.kind}:${a.order}`)).toEqual(["call:1", "message:3"]);
  });

  it("na segunda-feira libera a mensagem após a única ligação, com qualquer resultado", () => {
    for (const result of ["NAO", "SIM"]) {
      const released = nextReleasedAction({
        step: "E0",
        stepDueAt: "2026-09-14T12:00:00.000Z",
        operationalDate: "2026-09-14",
        states: [{ order: 1, status: "DONE", executedAt: "2026-09-14T12:00:00.000Z", result }],
      });
      expect(released?.action).toMatchObject({ order: 3, kind: "message" });
    }
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
        { order: 1, status: "DONE", executedAt: "2026-03-03T12:00:00.000Z", result: "NAO" },
        { order: 2, status: "PENDING" },
      ],
    });
    expect(released?.action.order).toBe(2);
    expect(new Date(released!.releaseAt).getTime()).toBeGreaterThanOrEqual(
      Date.parse("2026-03-03T12:10:00.000Z"),
    );
  });

  it("K–M) ligação 2 e mensagem seguem a mesma E0", () => {
    const second = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-09-15T12:00:00.000Z",
      operationalDate: "2026-09-15",
      states: [{ order: 1, status: "DONE", executedAt: "2026-09-15T12:00:00.000Z", result: "NAO" }],
    });
    expect(second).toMatchObject({ action: { order: 2, kind: "call" }, releaseAt: "2026-09-15T12:10:00.000Z" });
    const message = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-09-15T12:00:00.000Z",
      operationalDate: "2026-09-15",
      states: [
        { order: 1, status: "DONE", executedAt: "2026-09-15T12:00:00.000Z", result: "NAO" },
        { order: 2, status: "DONE", executedAt: "2026-09-15T12:10:00.000Z", result: "NAO" },
      ],
    });
    expect(message).toMatchObject({ action: { order: 3, kind: "message" }, releaseAt: "2026-09-15T12:10:00.000Z" });
  });

  it("de terça a sexta, atendimento na primeira ligação pula a segunda e libera a mensagem", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-09-15T12:00:00.000Z",
      operationalDate: "2026-09-15",
      states: [
        { order: 1, status: "DONE", executedAt: "2026-09-15T12:00:00.000Z", result: "SIM" },
        { order: 2, status: "CANCELLED" },
      ],
    });
    expect(released?.action).toMatchObject({ order: 3, kind: "message" });
  });

  it("na segunda, atendimento na primeira ligação usa CONTATO_REALIZADO sem segunda ligação", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-09-14T12:00:00.000Z",
      operationalDate: "2026-09-14",
      states: [{ order: 1, status: "DONE", executedAt: "2026-09-14T12:00:00.000Z", result: "SIM" }],
    });
    expect(released?.action).toMatchObject({ order: 3, kind: "message" });
  });


  it("mensagem concluída encerra o E0 sem recriar ações", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-03-03T12:00:00.000Z",
      states: [
        { order: 1, status: "DONE", executedAt: "2026-03-03T12:00:00.000Z" },
        { order: 2, status: "CANCELLED" },
        { order: 3, status: "DONE" },
      ],
      operationalDate: "2026-09-15",
    });
    expect(released).toBeNull();
  });

  it("C) SIM com CONTATO_REALIZADO concluído encerra E0 sem SEM_CONTATO", () => {
    const states = [
      { order: 1, status: "DONE" as const, executedAt: "2026-09-15T12:00:00.000Z", result: "SIM" },
      { order: 2, status: "CANCELLED" as const },
      { order: 3, status: "DONE" as const, executedAt: "2026-09-15T12:01:00.000Z" },
    ];
    expect(nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-09-15T12:00:00.000Z",
      operationalDate: "2026-09-15",
      states,
    })).toBeNull();
  });

  it("E) NAO libera a mensagem E0 correta após as tentativas aplicáveis", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-09-15T12:00:00.000Z",
      operationalDate: "2026-09-15",
      states: [
        { order: 1, status: "DONE", executedAt: "2026-09-15T12:00:00.000Z", result: "NAO" },
        { order: 2, status: "DONE", executedAt: "2026-09-15T12:10:00.000Z", result: "NAO" },
      ],
    });
    expect(released?.action).toMatchObject({ order: 3, kind: "message" });
  });

  it("G) reprocessar E0 concluída não recria mensagem", () => {
    const input = {
      ...base,
      actions: [
        { step: "E0", actionOrder: 1, actionKind: "call", status: "EXECUTED", dueAt: base.nowIso, executedAt: base.nowIso, result: "SIM" },
        { step: "E0", actionOrder: 2, actionKind: "call", status: "CANCELLED", dueAt: base.nowIso, executedAt: null, result: null },
        { step: "E0", actionOrder: 3, actionKind: "message", status: "EXECUTED", dueAt: base.nowIso, executedAt: base.nowIso, result: "enviado_manual" },
      ],
    };
    const decision = decideCadenceV2(input as never);
    if (decision.kind === "obligation") expect(decision.step).not.toBe("E0");
  });

  it("H) E1 continua sendo a próxima etapa normal após E0 concluída", () => {
    const decision = decideCadenceV2({ ...base, executedSteps: ["E0"] } as never);
    if (decision.kind === "obligation") expect(decision.step).toBe("E1");
  });

  it("não recria E0 quando o primeiro contato já foi executado", () => {
    const decision = decideCadenceV2({ ...base, executedSteps: ["E0"] } as never);
    if (decision.kind === "obligation") expect(decision.step).not.toBe("E0");
  });
});
