import { describe, expect, it } from "vitest";
import { decideNextAction } from "./decide";
import { initialRecord } from "./machine";
import { displayName } from "./names";
import type { CadenceRecord } from "./types";

function record(patch: Partial<CadenceRecord> = {}): CadenceRecord {
  return {
    ...initialRecord({ scope: "homologacao", leadId: "TEST-1", at: "2026-08-17T12:00:00.000Z" }),
    state: "ACTIVE",
    startedAt: "2026-08-17T12:00:00.000Z",
    lastOutboundAt: "2026-08-17T12:00:00.000Z",
    executedSteps: ["E0"],
    ...patch,
  } as CadenceRecord;
}

const ctx = {
  nowIso: "2026-08-21T13:00:00.000Z",
  hasTemplateForPurpose: () => true,
  enabled: true,
};

describe("primeira ação humana (NOVOS)", () => {
  it("não cria E1 enquanto o lead permanece em NOVOS", () => {
    const action = decideNextAction(record(), { ...ctx, awaitingFirstHumanAction: true });
    expect(action.kind).toBe("none");
    expect(action.reason).toContain("NOVOS");
  });

  it("conta a E1 a partir da saída de NOVOS, não do cadastro", () => {
    const action = decideNextAction(record(), {
      ...ctx,
      nowIso: "2026-08-19T13:00:00.000Z",
      awaitingFirstHumanAction: false,
      leftEntryStageAt: "2026-08-19T12:00:00.000Z",
    });
    expect(action.kind).toBe("schedule_step");
    if (action.kind === "schedule_step") {
      expect(action.step).toBe("E1");
      expect(action.dueAt > "2026-08-19T12:00:00.000Z").toBe(true);
    }
  });

  it("lead de sábado só começa a cadência depois da ação humana", () => {
    const weekend = record({
      startedAt: "2026-08-22T13:00:00.000Z",
      lastOutboundAt: "2026-08-22T13:00:00.000Z",
    });
    const monday = decideNextAction(weekend, {
      ...ctx,
      nowIso: "2026-08-24T13:00:00.000Z",
      awaitingFirstHumanAction: true,
    });
    expect(monday.kind).toBe("none");
  });
});

describe("apresentação de nomes", () => {
  it("padroniza maiúsculas e minúsculas preservando acentos e partículas", () => {
    expect(displayName("JOÃO")).toBe("João");
    expect(displayName("jOãO")).toBe("João");
    expect(displayName("maria DAS graças")).toBe("Maria das Graças");
    expect(displayName("ana-paula SOUZA")).toBe("Ana-Paula Souza");
  });
});
