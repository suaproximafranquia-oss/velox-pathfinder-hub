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
  it("a fila automática começa em L2, no PRÓXIMO DIA OPERACIONAL", () => {
    // 2026-08-17 é segunda-feira; a L1 é manual, feita ainda em NOVOS.
    // Movimentado em 17/08 (a qualquer hora) ⇒ tentativa em 18/08.
    expect(nextCallAttempt("2026-08-17", [])).toEqual({ step: 2, dueDate: "2026-08-18" });
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

  it("quarta tentativa automática ≈7 dias corridos após a anterior, em dia útil", () => {
    const history = [2, 3, 4].map((s) => attempt(s, "2026-08-17", "SIM"));
    // 2026-08-17 + 7 dias = 2026-08-24 (segunda-feira).
    expect(nextCallAttempt("2026-08-17", history)).toEqual({ step: 5, dueDate: "2026-08-24" });
  });

  it("quarta tentativa em fim de semana vai para o próximo dia útil", () => {
    const history = [2, 3, 4].map((s) => attempt(s, "2026-08-15", "SIM"));
    // 2026-08-15 + 7 = 2026-08-22 (sábado) → 2026-08-24 (segunda).
    expect(nextCallAttempt("2026-08-15", history)?.dueDate).toBe("2026-08-24");
  });

  it("esgotadas as quatro tentativas automáticas, nada mais é gerado", () => {
    const history = [2, 3, 4, 5].map((s) => attempt(s, "2026-08-17", "SIM"));
    expect(nextCallAttempt("2026-08-17", history)).toBeNull();
  });

  it("prefere um dia útil livre quando há mensagem prevista no mesmo dia", () => {
    const history = [attempt(2, "2026-08-19", "SIM")];
    const semPreferencia = nextCallAttempt("2026-08-17", history)!;
    const comPreferencia = nextCallAttempt("2026-08-17", history, [semPreferencia.dueDate])!;
    expect(comPreferencia.dueDate).not.toBe(semPreferencia.dueDate);
    expect(comPreferencia.step).toBe(semPreferencia.step);
  });

  it("coincidência inevitável é permitida — a ligação não é perdida", () => {
    const history = [attempt(2, "2026-08-19", "SIM")];
    const base = nextCallAttempt("2026-08-17", history)!;
    const bloqueado = nextCallAttempt("2026-08-17", history, [base.dueDate, "2026-08-21", "2026-08-24"])!;
    expect(bloqueado.dueDate).toBe(base.dueDate);
  });
});
