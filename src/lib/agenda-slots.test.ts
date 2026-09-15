import { describe, expect, it } from "vitest";
import { AGENDA_SLOT_HOURS, agendaDayRange, buildAgendaSlots, shiftAgendaDate } from "./agenda-slots";
import type { AgendaItem } from "./agenda-types";

const meeting: AgendaItem = {
  id: "meeting:TEST-AGENDA",
  title: "Reunião com João",
  kind: "reuniao",
  startsAt: "2026-09-15T17:00:00.000Z",
  endsAt: "2026-09-15T18:00:00.000Z",
  dateISO: "2026-09-15",
  priority: "maxima",
  readOnly: true,
};

describe("Agenda lateral da Ação do Dia", () => {
  it("monta somente os oito horários operacionais, sem almoço", () => {
    expect(AGENDA_SLOT_HOURS).toEqual([9, 10, 11, 13, 14, 15, 16, 17]);
    expect(buildAgendaSlots([], "2026-09-15").map((slot) => slot.label)).not.toContain("12:00 – 13:00");
  });

  it("marca horário passado sem compromisso como indisponível", () => {
    const slots = buildAgendaSlots([], "2026-09-15", new Date("2026-09-15T17:30:00.000Z"));
    expect(slots.find((slot) => slot.label.startsWith("09:00"))?.status).toBe("INDISPONIVEL");
    expect(slots.find((slot) => slot.label.startsWith("15:00"))?.status).toBe("LIVRE");
  });

  it("marca compromisso existente como ocupado e mantém os demais livres", () => {
    const slots = buildAgendaSlots([meeting], "2026-09-15");
    expect(slots.find((slot) => slot.label === "14:00 – 15:00")).toMatchObject({ occupied: true, title: "Reunião com João" });
    expect(slots.find((slot) => slot.label === "15:00 – 16:00")).toMatchObject({ occupied: false, title: null });
  });

  it("ignora ações sem horário e compromissos de outro dia", () => {
    const action = { ...meeting, id: "cadencia:1", kind: "acao" as const, startsAt: null, endsAt: null };
    expect(buildAgendaSlots([action, { ...meeting, dateISO: "2026-09-16" }], "2026-09-15").every((slot) => !slot.occupied)).toBe(true);
  });

  it("muda somente a data visual e calcula o intervalo do dia", () => {
    expect(shiftAgendaDate("2026-09-15", -1)).toBe("2026-09-14");
    expect(shiftAgendaDate("2026-09-15", 1)).toBe("2026-09-16");
    expect(agendaDayRange("2026-09-15")).toEqual({
      fromISO: "2026-09-15T03:00:00.000Z",
      toISO: "2026-09-16T02:59:59.999Z",
    });
  });
});