import { expect, it } from "vitest";
import type { DailyAction } from "@/lib/crm/daily-actions";
import { callActionHasMessage, formatDailyActionPhone } from "./daily-action-card";
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

it("formata visualmente celulares brasileiros sem alterar dígitos", () => {
  expect(formatDailyActionPhone("+5548988534230")).toBe("+55 48 98853 4230");
  expect(formatDailyActionPhone("+554888534230")).toBe("+55 48 8853 4230");
  expect(formatDailyActionPhone("554888534230")).toBe("+55 48 8853 4230");
});

it("não inventa o nono dígito nem modifica telefone irregular", () => {
  expect(formatDailyActionPhone("+554888534230")).toBe("+55 48 8853 4230");
  expect(formatDailyActionPhone("+55 48 123")).toBe("+55 48 123");
  expect(formatDailyActionPhone("telefone indisponível")).toBe("telefone indisponível");
});

it("oferece a mensagem após Atendeu somente nas etapas cujo plano possui mensagem", () => {
  expect(callActionHasMessage({ ...action("e0", "agora"), kind: "ligacao", stepLabel: "E0" })).toBe(true);
  expect(callActionHasMessage({ ...action("e3", "agora"), kind: "ligacao", stepLabel: "E3" })).toBe(true);
  expect(callActionHasMessage({ ...action("re0", "agora"), kind: "ligacao", stepLabel: "RE0" })).toBe(false);
});