import { describe, expect, it } from "vitest";
import {
  isCurrentEditorialStep,
  isValidStepCode,
  parseStepIdentity,
} from "./operational-steps";

describe("identidade da etapa = chave técnica", () => {
  it("separa código e título", () => {
    expect(parseStepIdentity("E5 — Apresentação Digital")).toEqual({
      code: "E5",
      title: "Apresentação Digital",
    });
    expect(parseStepIdentity("ER0 - Reentrada")).toEqual({ code: "ER0", title: "Reentrada" });
    expect(parseStepIdentity("R3 – Finalização do reengajamento").code).toBe("R3");
  });

  it("sem prefixo de código só altera o título", () => {
    expect(parseStepIdentity("Oferta da apresentação digital")).toEqual({
      code: null,
      title: "Oferta da apresentação digital",
    });
  });

  it("aceita códigos editoriais exatamente como digitados", () => {
    for (const code of ["E0", "E6", "E8", "R1", "R4", "RE0", "ER0", "ER3"]) {
      expect(isValidStepCode(code)).toBe(true);
      expect(isCurrentEditorialStep(code)).toBe(true);
    }
    expect(isValidStepCode("E5 x")).toBe(false);
  });

  it("chaves históricas nunca são identidade atual", () => {
    for (const key of ["E12", "E20", "E27", "FINALIZACAO", "V3", "TESTE"]) {
      expect(isCurrentEditorialStep(key)).toBe(false);
    }
  });

  /* RF passou a ser etapa operacional atual (relacionamento esfriado). */
  it("RF0 e RF1 são identidade editorial atual", () => {
    for (const key of ["RF0", "RF1"]) {
      expect(isCurrentEditorialStep(key)).toBe(true);
    }
  });
});
