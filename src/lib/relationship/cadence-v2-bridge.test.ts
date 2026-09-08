/**
 * PONTE V2 → MOTOR. Garante que, quando o estado V2 é informado, a
 * decisão do motor vem inteiramente da nova régua — sem cálculo por
 * dias úteis e sem segundo gerador.
 */
import { describe, expect, it } from "vitest";
import { decideNextAction } from "./decide";
import { decideCadenceV2 } from "./cadence-v2-decide";
import type { CadenceRecord } from "./types";

const record: CadenceRecord = {
  scope: "production",
  leadId: "gs_1",
  runId: null,
  state: "CADENCE_ACTIVE",
  previousState: null,
  flow: "sem_resposta",
  currentStep: "E0",
  executedSteps: ["E0"],
  startedAt: "2026-03-02T12:00:00.000Z",
  lastInboundAt: null,
  lastOutboundAt: null,
  updatedAt: "2026-03-02T12:00:00.000Z",
} as unknown as CadenceRecord;

const v2 = {
  nowIso: "2026-03-03T12:00:00.000Z",
  flow: "E" as const,
  originDate: "2026-03-02",
  actions: [
    {
      step: "E0",
      actionOrder: 1,
      actionKind: "message" as const,
      status: "EXECUTED",
      dueAt: "2026-03-02T12:00:00.000Z",
      executedAt: "2026-03-02T12:00:00.000Z",
      result: null,
    },
  ],
  executedSteps: ["E0"],
  cycle: { materialSent: false },
  stageKey: "em_andamento",
  awaitingHandoff: false,
};

describe("ponte cadence-v2 → decide", () => {
  it("delega a decisão à régua V2 quando o estado é informado", () => {
    const direct = decideCadenceV2(v2);
    const action = decideNextAction(record, {
      nowIso: v2.nowIso,
      enabled: true,
      v2,
    } as never);
    expect(direct.kind).toBe("obligation");
    expect(action.kind).toBe("schedule_step");
    if (action.kind === "schedule_step" && direct.kind === "obligation") {
      expect(action.step).toBe(direct.step);
      expect(action.dueAt).toBe(direct.dueAt);
      expect(action.actionKind).toBe(direct.actionKind);
    }
  });

  it("não cria obrigação com compromisso real em AGENDAMENTOS", () => {
    const action = decideNextAction(record, {
      nowIso: v2.nowIso,
      enabled: true,
      v2: { ...v2, stageKey: "agendamentos", hasCommitment: true },
    } as never);
    expect(action.kind).toBe("none");
  });

  it("não cria obrigação com compromisso real em VÍDEO", () => {
    const action = decideNextAction(record, {
      nowIso: v2.nowIso,
      enabled: true,
      v2: { ...v2, stageKey: "video", hasCommitment: true },
    } as never);
    expect(action.kind).toBe("none");
  });

  it("VÍDEO sem follow_up não congela a cadência", () => {
    const action = decideNextAction(record, {
      nowIso: v2.nowIso,
      enabled: true,
      v2: { ...v2, stageKey: "video", hasCommitment: false },
    } as never);
    expect(action.kind).toBe("schedule_step");
  });

  it("ligação atendida (awaiting_handoff histórico) NÃO congela mais a régua", () => {
    const action = decideNextAction(record, {
      nowIso: v2.nowIso,
      enabled: true,
      v2: { ...v2, awaitingHandoff: true },
    } as never);
    expect(action.kind).toBe("schedule_step");
  });

  it("atendeu e foi para FRIOS: a régua continua, sem bloqueio de encaminhamento", () => {
    const action = decideNextAction(record, {
      nowIso: v2.nowIso,
      enabled: true,
      v2: { ...v2, stageKey: "frio", awaitingHandoff: true },
    } as never);
    expect(action.kind).toBe("schedule_step");
  });
});
