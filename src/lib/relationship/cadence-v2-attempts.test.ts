import { describe, expect, it, vi } from "vitest";
import { createEngine } from "./engine";
import { initialRecord } from "./machine";
import { additionalCalls, additionalCallDeadline, ADDITIONAL_CALL_EXPIRED, compensatesE1, decideCadenceV2, type V2DecisionInput, type V2QueueAction } from "./cadence-v2-decide";
import { nextTransition, stepActions } from "./cadence-v2";
import type { EngineRepository } from "./ports";
import type { QueueItem } from "./types";

const firstAt = "2026-09-09T13:00:00.000Z";
const first: V2QueueAction = { step: "E1", actionOrder: 1, actionKind: "call", status: "EXECUTED", dueAt: firstAt, executedAt: firstAt, result: "NAO" };
const message: V2QueueAction = { ...first, actionOrder: 3, actionKind: "message", executedAt: "2026-09-09T13:01:00.000Z", result: "enviado_manual" };
const input = (actions: V2QueueAction[]): V2DecisionInput => ({ nowIso: firstAt, originDate: "2026-09-08", flow: "E", actions, executedSteps: ["E0"], cycle: { materialSent: false }, stageKey: "em_andamento", awaitingHandoff: false });

describe("E1/E2 — tentativas independentes no motor existente", () => {
  it("mensagem imediata e tentativa +2h coexistem, sem depender da mensagem", () => {
    expect(decideCadenceV2(input([first]))).toMatchObject({ step: "E1", actionOrder: 3, actionKind: "message", dueAt: firstAt });
    expect(additionalCalls(input([first]))).toEqual([{ step: "E1", order: 2, dueAt: "2026-09-09T15:00:00.000Z", expiresAt: "2026-09-09T20:30:00.000Z" }]);
  });

  it("usa fechamento do calendário existente inclusive sábado", () => {
    expect(additionalCallDeadline(firstAt)).toBe("2026-09-09T20:30:00.000Z");
    expect(additionalCallDeadline("2026-09-12T13:00:00.000Z")).toBe("2026-09-12T19:00:00.000Z");
  });

  it("E1 incompleta compensa E2, sem mudar data e sem propagar para E3", () => {
    const expired: V2QueueAction = { ...first, actionOrder: 2, status: "CANCELLED", executedAt: null, cancelReason: ADDITIONAL_CALL_EXPIRED };
    const done: V2QueueAction = { ...expired, status: "EXECUTED", executedAt: "2026-09-09T15:00:00.000Z", cancelReason: null };
    const incomplete = input([first, message, expired]);
    const complete = input([first, message, done]);
    expect(compensatesE1(incomplete.actions)).toBe(true);
    expect(compensatesE1(complete.actions)).toBe(false);
    expect(decideCadenceV2(incomplete)).toMatchObject({ step: "E2", dueAt: "2026-09-11T12:00:00.000Z" });
    expect(decideCadenceV2(complete)).toMatchObject({ step: "E2", dueAt: "2026-09-11T12:00:00.000Z" });
    const e2first = { ...first, step: "E2", dueAt: "2026-09-11T12:00:00.000Z", executedAt: "2026-09-11T12:00:00.000Z" };
    const e2 = input([...incomplete.actions, e2first]);
    expect(decideCadenceV2(e2)).toMatchObject({ step: "E2", actionOrder: 2, actionKind: "message", dueAt: e2first.executedAt });
    expect(additionalCalls(e2)).toMatchObject([{ step: "E2", order: 3, dueAt: "2026-09-11T14:00:00.000Z" }]);
    expect(additionalCalls(input([...complete.actions, e2first]))).toEqual([]);
    expect(stepActions("E3", true).filter((a) => a.kind === "call")).toHaveLength(1);
    expect(nextTransition("E1", { materialSent: false })).toEqual({ to: "E2", days: 2 });
  });

  it("cancelamento por contato/fluxo não gera compensação", () => {
    expect(compensatesE1([{ ...first, actionOrder: 2, status: "CANCELLED", cancelReason: "contact_attended" }])).toBe(false);
    expect(additionalCalls(input([{ ...first, result: "SIM" }]))).toEqual([]);
    expect(additionalCalls({ ...input([first]), stageKey: "video", hasCommitment: true })).toEqual([]);
  });

  it("persiste mensagem e adicional uma vez; expira adicional sem executar/envio e agenda E2 normal", async () => {
    const leadId = "TEST-0001";
    let now = firstAt;
    let record = { ...initialRecord({ scope: "homologation", leadId, at: "2026-09-08T12:00:00.000Z" }), state: "CADENCE_ACTIVE" as const, flow: "sem_resposta" as const, currentStep: "E0" as const, executedSteps: ["E0"] };
    const queue: QueueItem[] = [];
    const repo: EngineRepository = {
      scope: "homologation", runId: "TEST-RUN",
      loadRecord: async () => record,
      saveRecord: async (r) => { record = r as typeof record; },
      registerEvent: async () => true, loadQueue: async () => queue,
      upsertQueueItem: async (item) => {
        const existing = queue.find((q) => q.step === item.step && q.actionOrder === item.actionOrder);
        if (existing) return existing;
        const row = { ...item, id: `TEST-Q-${queue.length}` };
        queue.push(row); return row;
      },
      updateQueueItem: async (id, patch) => { const row = queue.find((q) => q.id === id); if (row) Object.assign(row, patch); },
      claimQueueItem: async () => true, cancelPendingItems: async () => 0,
      recordDecision: async () => {}, loadTemplates: async () => ({ bindings: [] }),
    };
    const send = vi.fn(async () => ({ delivered: false }));
    const engine = createEngine({ repository: repo, dispatcher: { scope: "homologation", assertRecipientAllowed: async () => ({ ok: true }), send }, enabled: true,
      clock: { kind: "virtual", now: () => new Date(now), nowIso: () => now },
      v2State: async () => ({ ...input([first, ...queue.map((q) => ({ step: q.step, actionOrder: q.actionOrder ?? 1, actionKind: q.actionKind ?? "message", status: q.status, dueAt: q.dueAt, executedAt: q.executedAt, result: q.result, cancelReason: q.cancelReason }))]), nowIso: now }),
    });
    await engine.tick(leadId);
    await engine.tick(leadId);
    expect(queue.filter((q) => q.step === "E1")).toHaveLength(2);
    expect(queue.find((q) => q.actionOrder === 2)?.dueAt).toBe("2026-09-09T15:00:00.000Z");
    expect(queue.find((q) => q.actionKind === "message")?.dueAt).toBe(firstAt);
    const msg = queue.find((q) => q.actionKind === "message");
    if (!msg) throw new Error("Mensagem não criada");
    Object.assign(msg, { status: "EXECUTED", executedAt: message.executedAt });
    now = "2026-09-09T20:30:00.000Z";
    await engine.tick(leadId);
    await engine.tick(leadId);
    expect(queue.find((q) => q.step === "E1" && q.actionOrder === 2)).toMatchObject({ status: "CANCELLED", cancelReason: ADDITIONAL_CALL_EXPIRED, executedAt: null });
    expect(queue.filter((q) => q.step === "E2")).toHaveLength(1);
    expect(queue.find((q) => q.step === "E2")?.dueAt).toBe("2026-09-11T12:00:00.000Z");
    expect(send).not.toHaveBeenCalled();
  });
});