import { describe, expect, it } from "vitest";
import { RELATIONSHIP_CONFIG, setExtraNonBusinessDays } from "./config";
import { stepDisplayLabel } from "./step-labels";

describe("Comando 3 — calendário administrável", () => {
  it("soma as datas extras ao calendário oficial sem apagar feriados", () => {
    const oficiais = setExtraNonBusinessDays([]);
    const comExtra = setExtraNonBusinessDays(["2026-03-02"]);
    expect(comExtra).toContain("2026-03-02");
    for (const dia of oficiais) expect(comExtra).toContain(dia);
    expect(RELATIONSHIP_CONFIG.nonBusinessDays).toContain("2026-03-02");
  });

  it("é idempotente e ignora datas inválidas", () => {
    const a = setExtraNonBusinessDays(["2026-03-02", "2026-03-02", "xx"]);
    const b = setExtraNonBusinessDays(["2026-03-02"]);
    expect(a).toEqual(b);
    expect(a.filter((d) => d === "2026-03-02")).toHaveLength(1);
    expect(a).not.toContain("xx");
    setExtraNonBusinessDays([]);
  });
});

describe("Comando 3 — rótulos de exibição", () => {
  it("mostra E6 para a chave técnica E20 e respeita o rótulo salvo", () => {
    expect(stepDisplayLabel("E20")).toBe("E6 — Apresentação Digital");
    expect(stepDisplayLabel("E20", "Apresentação")).toBe("Apresentação");
    expect(stepDisplayLabel("E1")).toBe("E1");
  });
});
