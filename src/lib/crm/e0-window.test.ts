import { describe, expect, it } from "vitest";
import { isE0NightWindow, nextE0Moment } from "./e0-window";

/** Horário local da operação (UTC-3): 22:30–06:59 bloqueado. */
const local = (iso: string) => new Date(iso);

describe("janela operacional da E0", () => {
  it("bloqueia 22:40, 00:30, 03:15 e 06:50", () => {
    expect(isE0NightWindow(local("2026-08-19T01:40:00Z"))).toBe(true); // 22:40 local
    expect(isE0NightWindow(local("2026-08-19T03:30:00Z"))).toBe(true); // 00:30
    expect(isE0NightWindow(local("2026-08-19T06:15:00Z"))).toBe(true); // 03:15
    expect(isE0NightWindow(local("2026-08-19T09:50:00Z"))).toBe(true); // 06:50
  });

  it("libera a partir das 07:00", () => {
    expect(isE0NightWindow(local("2026-08-19T10:05:00Z"))).toBe(false); // 07:05
    expect(isE0NightWindow(local("2026-08-19T18:00:00Z"))).toBe(false); // 15:00
    expect(isE0NightWindow(local("2026-08-19T01:00:00Z"))).toBe(false); // 22:00
  });

  it("adia para as 07:00 da próxima abertura", () => {
    expect(nextE0Moment(local("2026-08-19T01:40:00Z"))).toBe("2026-08-19T10:00:00.000Z"); // 22:40 → 07:00 do dia seguinte
    expect(nextE0Moment(local("2026-08-19T06:15:00Z"))).toBe("2026-08-19T10:00:00.000Z"); // 03:15 → 07:00
  });

  it("fora da madrugada devolve o próprio instante", () => {
    const iso = "2026-08-19T12:00:00.000Z";
    expect(nextE0Moment(local(iso))).toBe(iso);
  });
});
