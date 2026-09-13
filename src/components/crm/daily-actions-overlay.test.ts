import { expect, it } from "vitest";
import type { DailyAction } from "@/lib/crm/daily-actions";
import { reconcileSelectedActionKey } from "./daily-actions-overlay";

function action(actionKey: string, bucket: DailyAction["bucket"]): DailyAction {
  return {
    actionKey,
    source: bucket === "alerta" ? "portal_alert" : "queue",
    kind: bucket === "alerta" ? "alerta_portal" : "ligacao",
    leadId: `lead-${actionKey}`,
    name: actionKey,
    phone: "",
    scope: "green_sales",
    stepLabel: null,
    dueDate: "2026-09-13",
    startsAt: null,
    endsAt: null,
    overdue: false,
    priorityMax: false,
    bucket,
    title: actionKey,
    responsibleName: null,
    attempts: [],
  };
}

it("acompanha imediatamente a nova posição 1 após recompor a fila", () => {
  expect(reconcileSelectedActionKey([action("nova", "agora")], "antiga")).toBe("nova");
});

it("preserva apenas uma consulta de alerta ainda presente", () => {
  expect(
    reconcileSelectedActionKey([action("principal", "agora"), action("aviso", "alerta")], "aviso"),
  ).toBe("aviso");
  expect(reconcileSelectedActionKey([action("principal", "agora")], "aviso")).toBe("principal");
});