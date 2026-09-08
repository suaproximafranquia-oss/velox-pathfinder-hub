/**
 * E0 MANUAL NA RÉGUA V2 — Financeira /f.
 *
 * Garante a sequência ligação 1 → 10 min → ligação 2 → mensagem para
 * copiar, a abertura da cadência sem envio, a decisão em NOVOS e a
 * proteção da posição 1 na Ação do Dia.
 */
import { describe, expect, it } from "vitest";
import { applyEvent, initialRecord } from "./machine";
import { decideNextAction } from "./decide";
import { nextReleasedAction } from "./cadence-v2";
import { actionRank, normalizeDailyActions, type DailyAction } from "@/lib/crm/daily-actions";

const NOW = "2026-09-08T12:30:00.000Z"; // terça, 09:30 BRT

function baseRecord() {
  return initialRecord({ scope: "production", leadId: "gs_1", at: NOW });
}

describe("E0 manual — abertura na régua V2", () => {
  it("LEAD_CREATED com manualE0 abre a cadência em E0 sem enviar nada", () => {
    const { record } = applyEvent(baseRecord(), {
      id: "e0_manual_open_gs_1",
      scope: "production",
      leadId: "gs_1",
      type: "LEAD_CREATED",
      at: NOW,
      data: { manualE0: true },
    });
    expect(record.state).toBe("CADENCE_ACTIVE");
    expect(record.currentStep).toBe("E0");
    expect(record.startedBy).toBe("manual");
  });

  it("LEAD_CREATED comum continua sem iniciar a cadência", () => {
    const { record } = applyEvent(baseRecord(), {
      id: "x",
      scope: "production",
      leadId: "gs_1",
      type: "LEAD_CREATED",
      at: NOW,
    });
    expect(record.state).toBe("CADENCE_NOT_STARTED");
  });
});

describe("E0 manual — decisão em NOVOS", () => {
  const opened = applyEvent(baseRecord(), {
    id: "e0_manual_open_gs_1",
    scope: "production",
    leadId: "gs_1",
    type: "LEAD_CREATED",
    at: NOW,
    data: { manualE0: true },
  }).record;

  const v2 = (actions: Array<{ order: number; status: string; executedAt?: string; result?: string }>) => ({
    flow: "E" as const,
    nowIso: NOW,
    originDate: "2026-09-08",
    executedSteps: [] as string[],
    actions: actions.map((a) => ({
      step: "E0",
      actionOrder: a.order,
      actionKind: a.order === 3 ? ("message" as const) : ("call" as const),
      status: a.status,
      dueAt: NOW,
      executedAt: a.executedAt ?? null,
      result: a.result ?? null,
    })),
    cycle: { materialSent: false },
    stageKey: "novos",
    awaitingHandoff: false,
  });

  it("primeira ação é a ligação 1 da E0, mesmo com o lead em NOVOS", () => {
    const decision = decideNextAction(opened, { nowIso: NOW, enabled: true, stageAtClosing: "novos", v2: v2([]) } as never);
    expect(decision.kind).toBe("schedule_step");
    if (decision.kind === "schedule_step") {
      expect(decision.step).toBe("E0");
      expect(decision.actionOrder).toBe(1);
      expect(decision.actionKind).toBe("call");
    }
  });

  it("após ligação 1 não atendida, a 2ª ligação só libera 10 minutos depois", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: NOW,
      states: [{ order: 1, status: "DONE", executedAt: NOW, result: "NAO" }] as never,
    });
    expect(released?.action.order).toBe(2);
    expect(released?.releaseAt).toBe("2026-09-08T12:40:00.000Z");
  });

  it("após duas ligações não atendidas, libera a mensagem E0 (para copiar)", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: NOW,
      states: [
        { order: 1, status: "DONE", executedAt: NOW, result: "NAO" },
        { order: 2, status: "DONE", executedAt: "2026-09-08T12:45:00.000Z", result: "NAO" },
      ] as never,
    });
    expect(released?.action.order).toBe(3);
    expect(released?.action.kind).toBe("message");
  });

  it("E0 não é empurrada para a janela da régua (usa a janela do executivo)", () => {
    const released = nextReleasedAction({
      step: "E0",
      stepDueAt: "2026-09-08T21:30:00.000Z", // 18:30 BRT, fora da janela da régua
      states: [] as never,
    });
    expect(released?.releaseAt).toBe("2026-09-08T21:30:00.000Z");
  });

  it("E1+ continua bloqueada enquanto o lead está em NOVOS", () => {
    const decision = decideNextAction(opened, {
      nowIso: NOW,
      enabled: true,
      stageAtClosing: "novos",
      v2: { ...v2([]), executedSteps: ["E0"] },
    } as never);
    expect(decision.kind).toBe("none");
  });
});

describe("Ação do Dia — posição 1 protegida", () => {
  const item = (over: Partial<DailyAction>): DailyAction => ({
    actionKey: "k",
    source: "queue",
    kind: "ligacao",
    leadId: "gs_x",
    name: "X",
    phone: "",
    scope: null,
    stepLabel: "E0",
    dueDate: "2026-09-08",
    startsAt: null,
    endsAt: null,
    overdue: false,
    priorityMax: true,
    bucket: "hoje",
    title: "Ligação — Etapa E0",
    responsibleName: null,
    attempts: [],
    ...over,
  });

  it("a ação reivindicada fica antes de novas liberações E0", () => {
    const list = normalizeDailyActions([
      item({ actionKey: "queue:gs_b:E-E0-2:b", leadId: "gs_b", name: "Eduardo", queueActionOrder: 2 }),
      item({ actionKey: "queue:gs_a:E-E1-1:a", leadId: "gs_a", name: "Paulo", stepLabel: "E1", priorityMax: false, claimed: true }),
      item({ actionKey: "queue:gs_c:E-E0-2:c", leadId: "gs_c", name: "William", queueActionOrder: 2 }),
    ]);
    expect(list.map((a) => a.name)).toEqual(["Paulo", "Eduardo", "William"]);
    expect(actionRank(list[0]!)).toBe(0);
  });
});
