import { describe, expect, it } from "vitest";
import { RELATIONSHIP_CONFIG, setExtraNonBusinessDays } from "./config";
import { stepDisplayLabel, stepShortCode } from "./step-labels";

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

describe("Consolidação — rótulos de exibição (chave técnica = identidade)", () => {
  it("E20 é histórico; E6 é etapa atual própria; rótulo salvo é respeitado", () => {
    expect(stepDisplayLabel("E20")).toBe("E20 (histórico) — Apresentação Digital");
    expect(stepDisplayLabel("E6")).toBe("E6 — Acompanhamento da apresentação digital");
    expect(stepDisplayLabel("E20", "Apresentação")).toBe("Apresentação");
    expect(stepDisplayLabel("E1")).toBe("E1 — Primeiro acompanhamento");
  });

  it("título gravado com código de OUTRA etapa não contamina a identidade", () => {
    expect(stepDisplayLabel("E3", "E2 — Segundo acompanhamento")).toBe(
      "E3 — Terceiro acompanhamento",
    );
    expect(stepDisplayLabel("E7", "RE1 — Reentrada / conteúdo")).toBe(
      "E7 — Última tentativa de contato / definição sobre continuidade",
    );
    expect(stepDisplayLabel("E3", "E3 — Terceiro acompanhamento")).toBe(
      "E3 — Terceiro acompanhamento",
    );
    expect(stepShortCode("E27")).toBe("E7");
    expect(stepShortCode("E8")).toBe("E8");
  });
});
