import { describe, expect, it } from "vitest";
import { isE0Blocked, isE0NightWindow, nextE0Moment } from "./e0-window";

/**
 * Janela E0 (§16): Seg–Sex 07:00–22:30 · Sáb 07:00–12:00 · Dom sem envio.
 * Os horários são lidos no fuso local do runtime; as datas abaixo foram
 * escolhidas de modo que a interpretação seja a mesma em UTC e em
 * UTC-3 (horário da operação).
 */
const at = (iso: string) => new Date(iso);

// 2026-08-19 = quarta · 2026-08-21 = sexta · 2026-08-22 = sábado
// 2026-08-23 = domingo · 2026-08-24 = segunda

describe("janela operacional da E0 (§16)", () => {
  it("bloqueia madrugada e após 22:30 em dia útil", () => {
    expect(isE0Blocked(at("2026-08-19T01:40:00Z"))).toBe(true); // 22:40 BRT
    expect(isE0Blocked(at("2026-08-19T03:30:00Z"))).toBe(true); // 00:30
    expect(isE0Blocked(at("2026-08-19T09:50:00Z"))).toBe(true); // 06:50
  });

  it("libera dia útil entre 07:00 e 22:30", () => {
    expect(isE0Blocked(at("2026-08-19T10:05:00Z"))).toBe(false); // 07:05 BRT
    expect(isE0Blocked(at("2026-08-19T18:00:00Z"))).toBe(false); // 15:00
    expect(isE0Blocked(at("2026-08-19T01:00:00Z"))).toBe(false); // 22:00
  });

  it("sábado opera apenas das 07:00 às 12:00", () => {
    expect(isE0Blocked(at("2026-08-22T10:00:00Z"))).toBe(false); // sáb 07:00 BRT
    expect(isE0Blocked(at("2026-08-22T16:00:00Z"))).toBe(true); // sáb 13:00 BRT
    expect(isE0Blocked(at("2026-08-22T18:00:00Z"))).toBe(true); // sáb 15:00
  });

  it("domingo não envia em nenhum horário", () => {
    expect(isE0Blocked(at("2026-08-23T12:00:00Z"))).toBe(true);
    expect(isE0Blocked(at("2026-08-23T18:00:00Z"))).toBe(true);
  });

  it("nome histórico continua disponível", () => {
    expect(isE0NightWindow).toBe(isE0Blocked);
  });

  it("madrugada de dia útil adia para as 07:00 do mesmo dia", () => {
    expect(nextE0Moment(at("2026-08-19T06:15:00Z"))).toBe("2026-08-19T10:00:00.000Z"); // 03:15 → 07:00
  });

  it("noite de sexta adia para sábado 07:00", () => {
    expect(nextE0Moment(at("2026-08-22T01:40:00Z"))).toBe("2026-08-22T10:00:00.000Z"); // sex 22:40 → sáb 07:00
  });

  it("sábado após 12:00 adia para segunda 07:00 (domingo não envia)", () => {
    expect(nextE0Moment(at("2026-08-22T16:00:00Z"))).toBe("2026-08-24T10:00:00.000Z"); // sáb 13:00 → seg 07:00
  });

  it("domingo adia para segunda 07:00", () => {
    expect(nextE0Moment(at("2026-08-23T15:00:00Z"))).toBe("2026-08-24T10:00:00.000Z");
  });

  it("dentro da janela devolve o próprio instante", () => {
    const iso = "2026-08-19T12:00:00.000Z";
    expect(nextE0Moment(at(iso))).toBe(iso);
  });
});
