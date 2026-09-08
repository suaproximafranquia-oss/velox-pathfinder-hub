import { describe, expect, it } from "vitest";
import { classifyScannedLead } from "./sync-classification";

const since = new Date("2026-08-20T00:00:00Z");

describe("classificação explícita da entrada (A/B/C/D)", () => {
  it("A — lead novo: ausente do espelho, entrada recente na origem", () => {
    expect(
      classifyScannedLead({
        inWindow: true,
        inMirror: false,
        mirrorStage: null,
        resolvedStage: "novos",
        entryAt: "2026-08-21T14:00:00Z",
        since,
      }),
    ).toBe("A");
  });

  it("B — histórico ausente do espelho: entrada anterior à janela NUNCA é lead novo", () => {
    expect(
      classifyScannedLead({
        inWindow: false,
        inMirror: false,
        mirrorStage: null,
        resolvedStage: "zero_contato",
        entryAt: "2026-07-23T10:00:00Z",
        since,
      }),
    ).toBe("B");
  });

  it("B — na dúvida (data ausente ou inválida) NUNCA classifica como novo", () => {
    expect(
      classifyScannedLead({
        inWindow: true,
        inMirror: false,
        mirrorStage: null,
        resolvedStage: "novos",
        entryAt: null,
        since,
      }),
    ).toBe("B");
    expect(
      classifyScannedLead({
        inWindow: true,
        inMirror: false,
        mirrorStage: null,
        resolvedStage: "novos",
        entryAt: "data-invalida",
        since,
      }),
    ).toBe("B");
  });

  it("C — existe no espelho e a coluna da origem mudou", () => {
    expect(
      classifyScannedLead({
        inWindow: false,
        inMirror: true,
        mirrorStage: "novos",
        resolvedStage: "zero_contato",
        entryAt: "2026-05-10T10:00:00Z",
        since,
      }),
    ).toBe("C");
  });

  it("D — existe no espelho e nada mudou", () => {
    expect(
      classifyScannedLead({
        inWindow: false,
        inMirror: true,
        mirrorStage: "novos",
        resolvedStage: "novos",
        entryAt: "2026-05-10T10:00:00Z",
        since,
      }),
    ).toBe("D");
  });

  it("sem etiqueta de coluna resolvida NÃO há evidência de mudança (nunca rebaixa)", () => {
    expect(
      classifyScannedLead({
        inWindow: false,
        inMirror: true,
        mirrorStage: "novos",
        resolvedStage: null,
        entryAt: "2026-05-10T10:00:00Z",
        since,
      }),
    ).toBe("D");
  });

  describe("lead NOVO atrasado (origem devolve dias depois da entrada)", () => {
    const cutoverDate = "2026-09-03";
    it("A — em NOVOS, sem espelho, entrada após o corte: novo mesmo fora da janela", () => {
      expect(
        classifyScannedLead({
          inWindow: true,
          inMirror: false,
          mirrorStage: null,
          resolvedStage: "novos",
          resolvedIsEntry: true,
          cutoverDate,
          entryAt: "2026-09-05T00:22:39Z",
          since: new Date("2026-09-08T10:37:00Z"),
        }),
      ).toBe("A");
      expect(
        classifyScannedLead({
          inWindow: false,
          inMirror: false,
          mirrorStage: null,
          resolvedStage: "novos",
          resolvedIsEntry: true,
          cutoverDate,
          entryAt: "2026-09-05T00:22:39Z",
          since: new Date("2026-09-08T10:37:00Z"),
        }),
      ).toBe("A");
    });
    it("B — em NOVOS mas entrada anterior ao corte operacional", () => {
      expect(
        classifyScannedLead({
          inWindow: true,
          inMirror: false,
          mirrorStage: null,
          resolvedStage: "novos",
          resolvedIsEntry: true,
          cutoverDate,
          entryAt: "2026-08-30T10:00:00Z",
          since: new Date("2026-09-08T10:37:00Z"),
        }),
      ).toBe("B");
    });
    it("B — fora de NOVOS continua valendo a regra da janela", () => {
      expect(
        classifyScannedLead({
          inWindow: true,
          inMirror: false,
          mirrorStage: null,
          resolvedStage: "zero_contato",
          resolvedIsEntry: false,
          cutoverDate,
          entryAt: "2026-09-05T00:22:39Z",
          since: new Date("2026-09-08T10:37:00Z"),
        }),
      ).toBe("B");
    });
    it("B — sem data de corte definida, na dúvida nunca é novo", () => {
      expect(
        classifyScannedLead({
          inWindow: false,
          inMirror: false,
          mirrorStage: null,
          resolvedStage: "novos",
          resolvedIsEntry: true,
          cutoverDate: null,
          entryAt: "2026-09-05T00:22:39Z",
          since: new Date("2026-09-08T10:37:00Z"),
        }),
      ).toBe("B");
    });
  });
});
