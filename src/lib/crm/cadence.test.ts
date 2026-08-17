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
  it("a fila automática começa em L2, +2 dias úteis da entrada na etapa", () => {
    // 2026-08-17 é segunda-feira; a L1 é manual, feita ainda em NOVOS.
    expect(nextCallAttempt("2026-08-17", [])).toEqual({ step: 2, dueDate: "2026-08-19" });
  });

  it("L3 vence 1 dia útil após a L2 realmente executada", () => {
    const next = nextCallAttempt("2026-08-17", [attempt(2, "2026-08-19", "NAO")]);
    expect(next).toEqual({ step: 3, dueDate: "2026-08-20" });
  });

  it("ligar (SIM) não encerra a fila — L4 continua prevista", () => {
    const history = [attempt(2, "2026-08-19", "SIM"), attempt(3, "2026-08-20", "SIM")];
    expect(nextCallAttempt("2026-08-17", history)).toEqual({ step: 4, dueDate: "2026-08-25" });
  });

  it("L2 NÃO + L3 NÃO encerram o ciclo sem gerar L4", () => {
    const history = [attempt(2, "2026-08-19", "NAO"), attempt(3, "2026-08-20", "NAO")];
    expect(nextCallAttempt("2026-08-17", history)).toBeNull();
  });

  it("esgotadas as tentativas (L2, L3, L4), nada mais é gerado", () => {
    const history = [2, 3, 4].map((s) => attempt(s, "2026-08-17", "SIM"));
    expect(nextCallAttempt("2026-08-17", history)).toBeNull();
  });
});
