/** COMANDO 2A — regras da fila de ligações. */
import { describe, expect, it } from "vitest";
import {
  ELIGIBLE_STAGE_KEYS,
  isEligibleStage,
  nextCallAttempt,
  type CadenceAttempt,
} from "./cadence";

const attempt = (step: number, date: string, outcome: CadenceAttempt["outcome"]) => ({
  step,
  date,
  outcome,
});

describe("elegibilidade", () => {
  it("NOVOS não entra na fila de ligações", () => {
    expect(isEligibleStage("novos")).toBe(false);
    expect(ELIGIBLE_STAGE_KEYS).toEqual(["zero_contato", "frio"]);
  });

  it("ZERO CONTATO e FRIO são elegíveis", () => {
    expect(isEligibleStage("zero_contato")).toBe(true);
    expect(isEligibleStage("frio")).toBe(true);
  });
});

describe("sequência de ligações", () => {
  it("L1 vence na transição para a etapa elegível (dia útil)", () => {
    // 2026-08-17 é segunda-feira.
    expect(nextCallAttempt("2026-08-17", [])).toEqual({ step: 1, dueDate: "2026-08-17" });
  });

  it("conta a partir da ligação realmente executada", () => {
    const next = nextCallAttempt("2026-08-17", [attempt(1, "2026-08-18", "NAO")]);
    expect(next).toEqual({ step: 2, dueDate: "2026-08-20" });
  });

  it("atendeu (SIM) encerra a fila do ciclo", () => {
    expect(nextCallAttempt("2026-08-17", [attempt(1, "2026-08-17", "SIM")])).toBeNull();
  });

  it("L2 NÃO + L3 NÃO encerram o ciclo sem gerar L4", () => {
    const history = [
      attempt(1, "2026-08-17", "NAO"),
      attempt(2, "2026-08-19", "NAO"),
      attempt(3, "2026-08-20", "NAO"),
    ];
    expect(nextCallAttempt("2026-08-17", history)).toBeNull();
  });

  it("esgotadas as tentativas, nada mais é gerado", () => {
    const history = [1, 2, 3, 4].map((s) => attempt(s, "2026-08-17", "NAO"));
    expect(nextCallAttempt("2026-08-17", history)).toBeNull();
  });
});
