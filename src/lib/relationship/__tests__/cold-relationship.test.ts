import { describe, expect, it } from "vitest";
import {
  RF_ACTIVATION_AT,
  decideColdRelationship,
  lastEffectiveAttempt,
  rfDueAt,
  type RfQueueFact,
} from "../cold-relationship";

const NO_EVOLUTION = { stageKey: "frio", latestEventAt: null, latestMeetingAt: null };
const CLOSED_JOURNEY = [
  { instanceSeq: 1, active: false, startedAt: "2026-09-10T12:00:00.000Z", endedAt: null },
];

function executed(step: string, at: string): RfQueueFact {
  return { id: `q-${step}`, step, actionOrder: 1, status: "EXECUTED", dueAt: at, executedAt: at };
}

describe("RF — relacionamento esfriado", () => {
  it("usa a última tentativa efetiva, ignorando o próprio RF", () => {
    const queue = [executed("E7", "2026-09-20T13:00:00.000Z"), executed("E8", "2026-10-01T13:00:00.000Z"), executed("RF0", "2026-11-05T13:00:00.000Z")];
    expect(lastEffectiveAttempt(queue)).toBe("2026-10-01T13:00:00.000Z");
  });

  it("E encerrada → RF0 após 20 dias sem evolução", () => {
    const decision = decideColdRelationship({
      nowIso: "2026-10-25T12:00:00.000Z",
      queue: [executed("E8", "2026-10-01T13:00:00.000Z")],
      instances: CLOSED_JOURNEY,
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("schedule");
    if (decision.kind === "schedule") expect(decision.step).toBe("RF0");
  });

  it("R encerrada → RF0 após 20 dias", () => {
    const decision = decideColdRelationship({
      nowIso: "2026-10-30T12:00:00.000Z",
      queue: [executed("R4", "2026-10-01T13:00:00.000Z")],
      instances: CLOSED_JOURNEY,
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("schedule");
  });

  it("RE encerrada → RF0 após 20 dias", () => {
    const decision = decideColdRelationship({
      nowIso: "2026-10-30T12:00:00.000Z",
      queue: [executed("RE3", "2026-10-01T13:00:00.000Z")],
      instances: CLOSED_JOURNEY,
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("schedule");
  });

  it("antes dos 20 dias não cria RF0", () => {
    const decision = decideColdRelationship({
      nowIso: "2026-10-10T12:00:00.000Z",
      queue: [executed("E8", "2026-10-01T13:00:00.000Z")],
      instances: CLOSED_JOURNEY,
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("none");
  });

  it("lead em AGENDAMENTOS não recebe RF0", () => {
    const decision = decideColdRelationship({
      nowIso: "2026-10-30T12:00:00.000Z",
      queue: [executed("E8", "2026-10-01T13:00:00.000Z")],
      instances: CLOSED_JOURNEY,
      evolution: { stageKey: "agendamentos", latestEventAt: null, latestMeetingAt: null },
    });
    expect(decision.kind).toBe("none");
  });

  it("nova jornada ativa cancela o RF0 pendente, sem apagar a linha", () => {
    const decision = decideColdRelationship({
      nowIso: "2026-10-30T12:00:00.000Z",
      queue: [
        executed("E8", "2026-10-01T13:00:00.000Z"),
        { id: "rf", step: "RF0", actionOrder: 1, status: "PENDING", dueAt: "2026-10-22T12:00:00.000Z", executedAt: null },
      ],
      instances: [{ instanceSeq: 1, active: true, startedAt: "2026-09-10T12:00:00.000Z", endedAt: null }],
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("cancel");
  });

  it("RF0 executado → RF1 conta 30 dias da execução real", () => {
    const queue = [executed("E8", "2026-10-01T13:00:00.000Z"), executed("RF0", "2026-10-26T13:00:00.000Z")];
    const early = decideColdRelationship({ nowIso: "2026-11-10T12:00:00.000Z", queue, instances: CLOSED_JOURNEY, evolution: NO_EVOLUTION });
    expect(early.kind).toBe("none");
    const later = decideColdRelationship({ nowIso: "2026-12-05T12:00:00.000Z", queue, instances: CLOSED_JOURNEY, evolution: NO_EVOLUTION });
    expect(later.kind).toBe("schedule");
    if (later.kind === "schedule") {
      expect(later.step).toBe("RF1");
      expect(later.dueAt >= rfDueAt("2026-10-26T13:00:00.000Z", 30)).toBe(true);
    }
  });

  it("evolução antes do RF1 impede o RF1", () => {
    const decision = decideColdRelationship({
      nowIso: "2026-12-05T12:00:00.000Z",
      queue: [executed("E8", "2026-10-01T13:00:00.000Z"), executed("RF0", "2026-10-26T13:00:00.000Z")],
      instances: CLOSED_JOURNEY,
      evolution: { stageKey: "frio", latestEventAt: null, latestMeetingAt: "2026-11-20T12:00:00.000Z" },
    });
    expect(decision.kind).toBe("none");
  });

  it("RF1 é terminal — não existe RF2", () => {
    const decision = decideColdRelationship({
      nowIso: "2027-06-05T12:00:00.000Z",
      queue: [executed("E8", "2026-10-01T13:00:00.000Z"), executed("RF0", "2026-10-26T13:00:00.000Z"), executed("RF1", "2026-11-26T13:00:00.000Z")],
      instances: CLOSED_JOURNEY,
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("none");
  });

  it("mesma jornada não duplica RF0", () => {
    const decision = decideColdRelationship({
      nowIso: "2026-10-30T12:00:00.000Z",
      queue: [
        executed("E8", "2026-10-01T13:00:00.000Z"),
        { id: "rf", step: "RF0", actionOrder: 1, status: "PENDING", dueAt: "2026-10-22T12:00:00.000Z", executedAt: null },
      ],
      instances: CLOSED_JOURNEY,
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("none");
  });

  it("nova jornada completa permite NOVO RF0, sem tocar no RF antigo", () => {
    const decision = decideColdRelationship({
      nowIso: "2027-03-30T12:00:00.000Z",
      queue: [
        executed("E8", "2026-10-01T13:00:00.000Z"),
        { id: "rf0a", step: "RF0", actionOrder: 1, status: "EXECUTED", dueAt: null, executedAt: "2026-10-26T13:00:00.000Z" },
        { id: "rf1a", step: "RF1", actionOrder: 1, status: "EXECUTED", dueAt: null, executedAt: "2026-11-26T13:00:00.000Z" },
        { id: "re3", step: "RE3", actionOrder: 1, status: "EXECUTED", dueAt: null, executedAt: "2027-03-01T13:00:00.000Z" },
      ],
      instances: [
        { instanceSeq: 1, active: false, startedAt: "2026-09-10T12:00:00.000Z", endedAt: "2026-10-02T12:00:00.000Z" },
        { instanceSeq: 2, active: false, startedAt: "2027-02-01T12:00:00.000Z", endedAt: "2027-03-02T12:00:00.000Z" },
      ],
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("schedule");
    if (decision.kind === "schedule") {
      expect(decision.step).toBe("RF0");
      expect(decision.journeySeq).toBe(2);
    }
  });

  it("sem backfill: jornada anterior à ativação não gera RF", () => {
    const before = new Date(new Date(RF_ACTIVATION_AT).getTime() - 86400000 * 40).toISOString();
    const decision = decideColdRelationship({
      nowIso: "2026-10-30T12:00:00.000Z",
      queue: [executed("E8", before)],
      instances: CLOSED_JOURNEY,
      evolution: NO_EVOLUTION,
    });
    expect(decision.kind).toBe("none");
  });
});
