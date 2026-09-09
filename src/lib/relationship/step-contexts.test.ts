import { describe, expect, it } from "vitest";
import { resolveStepContext } from "./cadence-v2";
import { requiresStepContext, stepCombinations } from "./operational-steps";

describe("contextos das etapas", () => {
  it("E2/E3 usam o caminho V somente quando o motor o abriu; E1 é sempre normal", () => {
    const base = { materialSent: false, visualPath: false };
    expect(resolveStepContext(base, "E1")).toBeNull();
    expect(resolveStepContext(base, "E2")).toBeNull();
    expect(resolveStepContext({ ...base, visualPath: true }, "E1")).toBeNull();
    expect(resolveStepContext({ ...base, visualPath: true }, "E2")).toBe("V2");
    expect(resolveStepContext({ ...base, visualPath: true }, "E3")).toBe("V3");
  });

  it("R3 escolhe o contexto pela passagem histórica na E4", () => {
    expect(resolveStepContext({ materialSent: false }, "R3")).toBe("NAO_CHEGOU_E4");
    expect(
      resolveStepContext({ materialSent: false, reachedE4Historically: true }, "R3"),
    ).toBe("JA_PASSOU_E4");
  });

  it("E7/E8 continuam decididas pelo material efetivamente enviado", () => {
    expect(resolveStepContext({ materialSent: true }, "E7")).toBe("MATERIAL_ENVIADO");
    expect(resolveStepContext({ materialSent: false }, "E8")).toBe("SEM_CONTATO");
  });

  it("contexto é obrigatório só onde não existe linha sem contexto", () => {
    expect(requiresStepContext("R3")).toBe(true);
    expect(requiresStepContext("E7")).toBe(true);
    expect(requiresStepContext("E1")).toBe(false);
    expect(stepCombinations("E1")).toEqual([null]);
    expect(stepCombinations("E2")).toEqual([null, "V2"]);
    expect(stepCombinations("R3")).toEqual(["NAO_CHEGOU_E4", "JA_PASSOU_E4"]);
    expect(stepCombinations("E5")).toEqual([null]);
  });
});
