/**
 * BLOCO 2 — reconhecimento dinâmico de etapas.
 * Biblioteca ativa ∪ histórico = etapas reconhecidas.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  BASE_STEP_KEYS,
  isKnownStep,
  registerKnownSteps,
  resetDynamicKnownSteps,
  knownStepKeys,
} from "./step-registry";
import { FLOW_SEQUENCE } from "./config";

afterEach(() => resetDynamicKnownSteps());

describe("registro dinâmico de etapas", () => {
  it("Caso 1 — etapa atual continua reconhecida", () => {
    expect(isKnownStep("E1")).toBe(true);
    expect(isKnownStep("E12")).toBe(true);
    expect(isKnownStep("RE0")).toBe(true);
    expect(isKnownStep("E20")).toBe(true);
  });

  it("Caso 2 — etapa ativa da Biblioteca é reconhecida sem estar no código", () => {
    expect(BASE_STEP_KEYS.includes("E9")).toBe(false);
    expect(isKnownStep("E9")).toBe(false);
    registerKnownSteps(["E9"]); // veio da Biblioteca ativa
    expect(isKnownStep("E9")).toBe(true);
    expect(knownStepKeys()).toContain("E9");
  });

  it("Caso 3 — etapa histórica continua reconhecida fora da Biblioteca", () => {
    registerKnownSteps(["E77"]); // veio apenas do histórico
    expect(isKnownStep("e77")).toBe(true);
  });

  it("Caso 4 — etapa inexistente continua desconhecida", () => {
    expect(isKnownStep("E404")).toBe(false);
    expect(isKnownStep("")).toBe(false);
    expect(isKnownStep(null)).toBe(false);
  });

  it("Caso 5 — E0 e etapas especiais preservadas", () => {
    for (const step of ["E0", "E0_V1", "E30", "E27", "FINALIZACAO", "RESPOSTA_AUTOMATICA"]) {
      expect(isKnownStep(step)).toBe(true);
    }
  });

  it("Caso 6 — a ordem dos fluxos não muda", () => {
    registerKnownSteps(["E9"]);
    expect(FLOW_SEQUENCE.sem_resposta).toEqual(["E0", "E1", "E3", "E4", "E12", "E30"]);
    expect(FLOW_SEQUENCE.visualizacao).toEqual(["E0", "E1", "V3", "V4"]);
    expect(FLOW_SEQUENCE.sem_resposta).not.toContain("E9");
  });
});
