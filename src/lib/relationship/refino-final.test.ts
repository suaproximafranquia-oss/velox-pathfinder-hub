/**
 * REFINO FINAL — COMANDO 1/3.
 * Cobre as decisões fechadas: etapa terminal com as duas grafias,
 * janelas oficiais, feriados nacionais + SP e registro de etapas.
 */
import { describe, expect, it } from "vitest";
import {
  CANONICAL_TERMINAL_STAGE,
  canonicalStageKey,
  isTerminalStage,
} from "./closing";
import { RELATIONSHIP_CONFIG } from "./config";
import { isBusinessDay, isEligibleMoment, messagingHours } from "./calendar";
import { brazilSpHolidays, easterSunday } from "./holidays";
import { isKnownStep, unknownStepReason } from "./step-registry";

const local = (day: string, hour: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, Math.round((hour + 3) * 60), 0)).toISOString();
};

describe("OPORTUNIDADE — as duas grafias são a mesma etapa", () => {
  it("leitura reconhece singular e plural", () => {
    expect(isTerminalStage("oportunidade")).toBe(true);
    expect(isTerminalStage("oportunidades")).toBe(true);
    expect(isTerminalStage("frio")).toBe(false);
  });

  it("gravação nova usa sempre a forma canônica", () => {
    expect(canonicalStageKey("oportunidades")).toBe(CANONICAL_TERMINAL_STAGE);
    expect(canonicalStageKey("frio")).toBe("frio");
    expect(canonicalStageKey(null)).toBeNull();
  });
});

describe("janelas oficiais", () => {
  it("motor 09:00–21:00 e fechamento às 22:00", () => {
    expect(RELATIONSHIP_CONFIG.businessHours).toEqual({ start: 9, end: 21 });
    expect(RELATIONSHIP_CONFIG.dailyClosingHour).toBe(22);
  });

  it("E0 mantém janela própria 07:00–22:30", () => {
    expect(RELATIONSHIP_CONFIG.e0Hours).toEqual({ start: 7, end: 22.5 });
  });
});

describe("feriados nacionais + SP", () => {
  it("Páscoa e derivados são calculados", () => {
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    const list = brazilSpHolidays(2026);
    expect(list).toContain("2026-04-03"); // Sexta-feira Santa
    expect(list).toContain("2026-02-17"); // Carnaval
    expect(list).toContain("2026-07-09"); // Revolução Constitucionalista (SP)
  });

  it("feriado não é dia útil e não tem janela de envio", () => {
    // 2026-09-07 é segunda-feira e feriado nacional.
    expect(isBusinessDay("2026-09-07")).toBe(false);
    expect(messagingHours("2026-09-07")).toBeNull();
    expect(isEligibleMoment(local("2026-09-07", 10))).toBe(false);
  });
});

describe("registro de etapas", () => {
  it("etapa oficial é aceita e etapa inventada é recusada", () => {
    expect(isKnownStep("E1")).toBe(true);
    expect(isKnownStep("E20")).toBe(true);
    expect(isKnownStep("E99")).toBe(false);
    expect(unknownStepReason("E99")).toContain("Etapa desconhecida");
  });
});
