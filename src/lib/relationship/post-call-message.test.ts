import { describe, expect, it } from "vitest";
import {
  POST_CALL_MATERIAL_SOURCE_STEPS,
  POST_CALL_MATERIAL_STEP,
  resolvePostCallLibraryStep,
} from "./post-call-message";

describe("mensagem universal após ligação", () => {
  it.each(POST_CALL_MATERIAL_SOURCE_STEPS)(
    "%s + SIM usa exclusivamente ENVIO_MATERIAL_POS_CONTATO",
    (step) => {
      expect(resolvePostCallLibraryStep(step, "SIM")).toBe(POST_CALL_MATERIAL_STEP);
    },
  );

  it.each(POST_CALL_MATERIAL_SOURCE_STEPS)(
    "%s + NÃO preserva a mensagem específica",
    (step) => {
      expect(resolvePostCallLibraryStep(step, "NAO")).toBe(step);
    },
  );

  it("não redireciona etapas fora da regra", () => {
    expect(resolvePostCallLibraryStep("E8", "SIM")).toBe("E8");
  });
});