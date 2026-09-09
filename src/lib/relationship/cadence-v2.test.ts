/**
 * Testes direcionados da régua final da cadência (Financeira /f).
 * Semana de referência: agosto/2026 (sem feriados nacionais).
 */
import { describe, expect, it } from "vitest";
import {
  canStartReengagement,
  isCadenceFrozen,
  isCadenceOpenDay,
  isStepComplete,
  nextReleasedAction,
  nextTransition,
  planDue,
  projectedPath,
  resolveStepContext,
  shiftTheoreticalDate,
  simulateCycle,
  stepActions,
  type CycleContext,
} from "./cadence-v2";

const SEM_MATERIAL: CycleContext = { materialSent: false };

function run(originDate: string, cycle: CycleContext = SEM_MATERIAL) {
  return simulateCycle({ first: "E0", originDate, cycle });
}

function weekday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

describe("calendário da cadência", () => {
  it("desloca sábado para segunda e domingo para terça", () => {
    expect(shiftTheoreticalDate("2026-08-08")).toBe("2026-08-10"); // sáb → seg
    expect(shiftTheoreticalDate("2026-08-09")).toBe("2026-08-11"); // dom → ter
  });

  it("sábado é dia operacional para execução, domingo não", () => {
    expect(isCadenceOpenDay("2026-08-08")).toBe(true);
    expect(isCadenceOpenDay("2026-08-09")).toBe(false);
  });

  it("desloca feriado para o próximo dia operacional", () => {
    // 07/09/2026 é segunda-feira e feriado nacional.
    expect(shiftTheoreticalDate("2026-09-07")).toBe("2026-09-08");
  });
});

describe("fluxo E — caminho sem resposta", () => {
  it("segue exatamente E0 → E1 → E2 → E3 → E4 → E7 → E8", () => {
    expect(projectedPath("E0", SEM_MATERIAL).map((p) => p.step)).toEqual([
      "E0", "E1", "E2", "E3", "E4", "E7", "E8",
    ]);
  });

  it("entrada na segunda encerra por volta de D14", () => {
    const cycle = run("2026-08-03");
    expect(cycle.at(-1)?.step).toBe("E8");
    expect(cycle.at(-1)?.offsetDays).toBe(14);
  });

  it("entrada na sexta absorve o fim de semana sem alongar o ciclo", () => {
    const cycle = run("2026-08-07");
    /** Base de 12 dias (E4→E7 = 3, E7→E8 = 2). */
    expect(cycle.at(-1)?.offsetDays).toBe(12);
  });

  it("entrada no sábado desloca a régua para segunda", () => {
    const cycle = run("2026-08-08");
    expect(cycle[0]?.date).toBe("2026-08-10");
    expect(cycle.at(-1)?.offsetDays).toBeLessThanOrEqual(17);
  });

  it("entrada no domingo nunca executa no domingo", () => {
    const cycle = run("2026-08-09");
    for (const item of cycle) expect(weekday(item.date)).not.toBe(0);
  });

  it("nunca coloca duas etapas do mesmo lead no mesmo dia", () => {
    for (const origin of ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"]) {
      const dates = run(origin).map((i) => i.date);
      expect(new Set(dates).size).toBe(dates.length);
    }
  });

  it("atraso desloca a etapa seguinte, sem comprimir nem empilhar", () => {
    // E2 teórica cairia em 06/08, mas E1 só foi executada em 07/08.
    const plan = planDue({
      originDate: "2026-08-03",
      theoreticalOffset: 3,
      previousExecutionIso: "2026-08-07T18:00:00.000Z", // 15:00 local
    });
    expect(plan.theoreticalDate).toBe("2026-08-06");
    expect(plan.operationalDate).toBe("2026-08-07");
    expect(plan.shiftedBy).toContain("previous_execution_floor");
  });
});

describe("ramificação com material", () => {
  it("E4 → E5 é imediato e segue +7 / +2 / +3", () => {
    expect(nextTransition("E4", { materialSent: false, materialRequested: true })).toEqual({
      to: "E5",
      days: 0,
      immediate: true,
    });
    expect(nextTransition("E5", SEM_MATERIAL)).toEqual({ to: "E6", days: 7 });
    expect(nextTransition("E6", SEM_MATERIAL)).toEqual({ to: "E7", days: 2 });
    expect(nextTransition("E7", SEM_MATERIAL)).toEqual({ to: "E8", days: 2 });
  });

  it("sem resposta, E4 vai direto para E7", () => {
    expect(nextTransition("E4", SEM_MATERIAL)?.to).toBe("E7");
  });

  it("E5 executa sem intervalo artificial após a resposta", () => {
    const cycle = simulateCycle({
      first: "E4",
      originDate: "2026-08-03",
      cycle: { materialSent: false, materialRequested: true },
      materialRequestedAt: "2026-08-03T15:00:00.000Z",
    });
    expect(cycle[1]?.step).toBe("E5");
    expect(cycle[1]?.date).toBe("2026-08-04");
  });
});

describe("contexto de E7/E8", () => {
  it("usa MATERIAL_ENVIADO quando existe registro estruturado", () => {
    expect(resolveStepContext({ materialSent: true })).toBe("MATERIAL_ENVIADO");
  });
  it("usa SEM_CONTATO quando não existe registro", () => {
    expect(resolveStepContext({ materialSent: false })).toBe("SEM_CONTATO");
  });
});

describe("fluxo R", () => {
  it("sem material: R1 → R2 → R3 → R4", () => {
    expect(projectedPath("R1", SEM_MATERIAL).map((p) => p.step)).toEqual(["R1", "R2", "R3", "R4"]);
  });
  it("com material: R3 é pulada", () => {
    expect(projectedPath("R1", { materialSent: true }).map((p) => p.step)).toEqual([
      "R1", "R2", "R4",
    ]);
  });
});

describe("fluxo RE", () => {
  it("com nova apresentação: RE0 → RE1 → RE2 → RE3", () => {
    expect(
      projectedPath("RE0", { materialSent: false, needsNewPresentation: true }).map((p) => p.step),
    ).toEqual(["RE0", "RE1", "RE2", "RE3"]);
  });
  it("com material já enviado: RE0 → RE1 → RE3", () => {
    expect(projectedPath("RE0", { materialSent: true }).map((p) => p.step)).toEqual([
      "RE0", "RE1", "RE3",
    ]);
  });
});

describe("ações internas da etapa", () => {
  it("E1 libera mensagem após ligação 1 e mantém ligação adicional +2h", () => {
    expect(stepActions("E1").map((a) => `${a.kind}:${a.order}`)).toEqual([
      "call:1", "message:3", "call:2",
    ]);
    expect(stepActions("E1")[2]?.waitHoursAfterPrevious).toBe(2);
  });

  it("E2, E3 e E4 são ligação seguida de mensagem", () => {
    for (const step of ["E2", "E3", "E4"] as const) {
      expect(stepActions(step).map((a) => a.kind)).toEqual(["call", "message"]);
    }
  });

  it("ligação 1 às 14:00 libera a mensagem imediatamente", () => {
    const released = nextReleasedAction({
      step: "E1",
      stepDueAt: "2026-08-03T12:00:00.000Z",
      states: [{ order: 1, status: "DONE", executedAt: "2026-08-03T17:00:00.000Z" }],
    });
    expect(released?.action.order).toBe(3);
    expect(released?.releaseAt).toBe("2026-08-03T17:00:00.000Z");
  });

  it("ligação adicional usa +2h da primeira, nunca a próxima abertura", () => {
    const released = nextReleasedAction({
      step: "E1",
      stepDueAt: "2026-08-03T12:00:00.000Z",
      states: [
        { order: 1, status: "DONE", executedAt: "2026-08-03T19:00:00.000Z" },
        { order: 3, status: "DONE", executedAt: "2026-08-03T19:01:00.000Z" },
      ],
    });
    expect(released?.action.order).toBe(2);
    expect(released?.releaseAt).toBe("2026-08-03T21:00:00.000Z"); // expira às 17:30 antes de liberar
  });

  it("a mensagem não é liberada antes da ligação da mesma etapa", () => {
    const released = nextReleasedAction({
      step: "E2",
      stepDueAt: "2026-08-03T12:00:00.000Z",
      states: [],
    });
    expect(released?.action.kind).toBe("call");
  });

  it("a etapa só conclui depois da última ação aplicável", () => {
    expect(
      isStepComplete("E2", [{ order: 1, status: "DONE", executedAt: "2026-08-03T13:00:00.000Z" }]),
    ).toBe(false);
    expect(
      isStepComplete("E2", [
        { order: 1, status: "DONE", executedAt: "2026-08-03T13:00:00.000Z" },
        { order: 2, status: "DONE", executedAt: "2026-08-03T14:00:00.000Z" },
      ]),
    ).toBe(true);
  });

  it("mudança de fluxo durante a etapa retira as ações seguintes da fila", () => {
    const released = nextReleasedAction({
      step: "E2",
      stepDueAt: "2026-08-03T12:00:00.000Z",
      states: [{ order: 1, status: "DONE", executedAt: "2026-08-03T13:00:00.000Z" }],
      flowChanged: true,
    });
    expect(released).toBeNull();
  });
});

describe("agendamento", () => {
  it("congela apenas com compromisso real (AGENDAMENTOS/VÍDEO + follow_up)", () => {
    expect(isCadenceFrozen({ stageKey: "agendamentos", hasCommitment: true })).toBe(true);
    expect(isCadenceFrozen({ stageKey: "video", hasCommitment: true })).toBe(true);
    expect(isCadenceFrozen({ stageKey: "video", hasCommitment: false })).toBe(false);
    expect(isCadenceFrozen({ stageKey: "agendamentos", hasCommitment: false })).toBe(false);
    expect(isCadenceFrozen({ stageKey: "frio", hasCommitment: true })).toBe(false);
    // Leitura antiga (sem o fato): AGENDAMENTOS mantém o comportamento histórico.
    expect(isCadenceFrozen({ stageKey: "agendamentos" })).toBe(true);
    expect(isCadenceFrozen({ stageKey: "video" })).toBe(false);
  });

  it("R só é liberado pela movimentação humana AGENDAMENTOS → FRIOS", () => {
    expect(
      canStartReengagement({
        previousStageKey: "agendamentos",
        currentStageKey: "frio",
        movedByHuman: true,
      }),
    ).toBe(true);
    expect(
      canStartReengagement({
        previousStageKey: "agendamentos",
        currentStageKey: "frio",
        movedByHuman: false,
      }),
    ).toBe(false);
    expect(
      canStartReengagement({
        previousStageKey: "agendamentos",
        currentStageKey: "agendamentos",
        movedByHuman: true,
      }),
    ).toBe(false);
  });
});
