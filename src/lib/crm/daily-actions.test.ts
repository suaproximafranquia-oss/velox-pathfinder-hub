import { describe, expect, it } from "vitest";
import {
  dedupeDailyActions,
  normalizeDailyActions,
  operationalDate,
  resolveBucket,
  summarizeDailyActions,
  type DailyAction,
} from "@/lib/crm/daily-actions";

function action(partial: Partial<DailyAction> & { actionKey: string }): DailyAction {
  return {
    source: "queue",
    kind: "mensagem",
    leadId: "gs_1",
    name: "Investidor",
    phone: "",
    scope: "green_sales",
    stepLabel: null,
    dueDate: "2026-02-10",
    startsAt: null,
    endsAt: null,
    overdue: false,
    priorityMax: false,
    bucket: "hoje",
    title: "Ação",
    responsibleName: null,
    attempts: [],
    ...partial,
  };
}

describe("Ações do Dia — regras puras", () => {
  const now = "2026-02-10T14:00:00.000Z"; // 11:00 em America/Sao_Paulo

  it("usa o fuso operacional para a data do dia", () => {
    expect(operationalDate("2026-02-11T02:00:00.000Z")).toBe("2026-02-10");
  });

  it("nunca converte ação atrasada em ação de hoje", () => {
    expect(resolveBucket({ dueDate: "2026-02-09", startsAt: null, nowIso: now })).toBe("atrasada");
    expect(resolveBucket({ dueDate: "2026-02-10", startsAt: null, nowIso: now })).toBe("hoje");
    expect(resolveBucket({ dueDate: "2026-02-12", startsAt: null, nowIso: now })).toBe("futura");
  });

  it("coloca em foco o compromisso próximo do horário", () => {
    expect(
      resolveBucket({
        dueDate: "2026-02-10",
        startsAt: "2026-02-10T14:10:00.000Z",
        nowIso: now,
      }),
    ).toBe("agora");
    expect(
      resolveBucket({
        dueDate: "2026-02-10",
        startsAt: "2026-02-10T18:00:00.000Z",
        nowIso: now,
      }),
    ).toBe("hoje");
  });

  it("colapsa a mesma ação vinda de duas fontes, mantendo a de maior precedência", () => {
    const rows = dedupeDailyActions([
      action({ actionKey: "k", source: "cadence", kind: "ligacao" }),
      action({ actionKey: "k", source: "meeting", kind: "reuniao" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("meeting");
  });

  it("ordena reunião em foco, depois atrasadas, depois o restante", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "hoje", bucket: "hoje" }),
      action({ actionKey: "atrasada", bucket: "atrasada" }),
      action({
        actionKey: "reuniao",
        kind: "reuniao",
        source: "meeting",
        priorityMax: true,
        bucket: "agora",
        startsAt: "2026-02-10T14:10:00.000Z",
      }),
    ]);
    expect(rows.map((r) => r.actionKey)).toEqual(["reuniao", "atrasada", "hoje"]);
  });

  it("resume a fila sem contar duas vezes", () => {
    const summary = summarizeDailyActions(
      normalizeDailyActions([
        action({ actionKey: "a", bucket: "atrasada" }),
        action({ actionKey: "a", bucket: "atrasada" }),
        action({ actionKey: "b", bucket: "hoje" }),
        action({ actionKey: "c", kind: "reuniao", source: "meeting", bucket: "agora" }),
      ]),
    );
    expect(summary).toEqual({ overdue: 1, today: 2, meetings: 1, total: 3 });
  });
});
