import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { DailyAction } from "@/lib/crm/daily-actions";
import { formatDailyActionPhone } from "./daily-action-card";
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

it("preserva somente a ação efetivamente ativa durante a releitura silenciosa", () => {
  const processing = { ...action("processing", "hoje"), claimed: true, active: true };
  const incoming = action("incoming", "hoje");
  expect(reconcileSelectedActionKey([processing, incoming], "processing")).toBe("processing");
});

it("não troca o card ativo por outro PROCESSING persistido", () => {
  const active = { ...action("active", "hoje"), claimed: true, active: true };
  const stale = { ...action("stale", "hoje"), claimed: true };
  expect(reconcileSelectedActionKey([active, stale], "active")).toBe("active");
});

it("reload sem card ativo segue a primeira posição elegível, não o PROCESSING antigo", () => {
  const e0 = { ...action("e0", "hoje"), stepLabel: "E0" };
  const stale = { ...action("stale", "hoje"), claimed: true };
  expect(reconcileSelectedActionKey([e0, stale], null)).toBe("e0");
});

it("usa a mesma leitura silenciosa em intervalo aproximado de um minuto", () => {
  const source = readFileSync(new URL("./daily-actions-overlay.tsx", import.meta.url), "utf8");
  expect(source).toContain("}, 60_000)");
  expect(source).toContain("void load(true)");
});

it("mantém a Agenda independente da fila e em atualização de três minutos", () => {
  const overlay = readFileSync(new URL("./daily-actions-overlay.tsx", import.meta.url), "utf8");
  const agenda = readFileSync(new URL("../agenda/daily-actions-agenda.tsx", import.meta.url), "utf8");
  expect(overlay).toContain("<DailyActionsAgenda />");
  expect(agenda).toContain("180_000");
  expect(agenda).toContain("listAgenda");
  expect(agenda).not.toContain("createAgendaEvent");
  expect(agenda).not.toContain("deleteAgendaEvent");
  expect(agenda).not.toContain("adapter.load");
});

it("formata visualmente celulares brasileiros sem alterar dígitos", () => {
  expect(formatDailyActionPhone("11948949027")).toBe("+55 (11) 94894-9027");
  expect(formatDailyActionPhone("+5511948949027")).toBe("+55 (11) 94894-9027");
  expect(formatDailyActionPhone("(11) 94894-9027")).toBe("+55 (11) 94894-9027");
  expect(formatDailyActionPhone("+5548988534230")).toBe("+55 (48) 98853-4230");
  expect(formatDailyActionPhone("+554888534230")).toBe("+55 (48) 8853-4230");
  expect(formatDailyActionPhone("554888534230")).toBe("+55 (48) 8853-4230");
});

it("não inventa o nono dígito nem modifica telefone irregular", () => {
  expect(formatDailyActionPhone("+554888534230")).toBe("+55 (48) 8853-4230");
  expect(formatDailyActionPhone("+55 48 123")).toBe("+55 48 123");
  expect(formatDailyActionPhone("telefone indisponível")).toBe("telefone indisponível");
});
