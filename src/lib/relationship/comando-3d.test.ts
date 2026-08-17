/** COMANDO 3D — fechamento operacional, janelas de envio e fluxo RF. */
import { describe, expect, it } from "vitest";
import { isEligibleMoment, nextEligibleMoment, isAfterDailyClosing, messagingHours } from "./calendar";
import { evaluateDailyClosing, stageAtClosing, isTerminalStage } from "./closing";
import { FLOW_SEQUENCE, STEPS } from "./config";
import { HOMOLOGATION_MESSAGES } from "./messages";
import { resolveCooledFlow } from "./entry";
import { CONTENT_GROUPS, REQUIRED_CONTENT_GROUPS } from "./content";

// Fusos: America/Sao_Paulo = UTC-3.
const local = (day: string, hour: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hour + 3, 0, 0)).toISOString();
};

describe("§8/§11 — janela de envio de mensagens", () => {
  it("segunda a sexta envia das 09:00 às 21:00", () => {
    expect(isEligibleMoment(local("2026-08-17", 9))).toBe(true);
    expect(isEligibleMoment(local("2026-08-17", 20))).toBe(true);
    expect(isEligibleMoment(local("2026-08-17", 8))).toBe(false);
    expect(isEligibleMoment(local("2026-08-17", 21))).toBe(false);
  });

  it("sábado tem janela própria e domingo nunca envia", () => {
    expect(messagingHours("2026-08-22")).not.toBeNull(); // sábado
    expect(messagingHours("2026-08-23")).toBeNull(); // domingo
    expect(isEligibleMoment(local("2026-08-23", 10))).toBe(false);
  });

  it("§9/§10 — fora da janela a etapa é deslocada para frente, nunca perdida", () => {
    const next = nextEligibleMoment(local("2026-08-23", 10));
    expect(next).toBe(local("2026-08-24", 9));
  });
});

describe("§3 — fechamento operacional às 22:00", () => {
  it("depois das 22:00 o dia está fechado", () => {
    expect(isAfterDailyClosing(local("2026-08-17", 22))).toBe(true);
    expect(isAfterDailyClosing(local("2026-08-17", 21))).toBe(false);
  });

  it("vale o estado do lead no fechamento, não o do meio do dia", () => {
    const transitions = [
      { stageKey: "zero_contato", at: local("2026-08-17", 10) },
      { stageKey: "oportunidade", at: local("2026-08-17", 18) },
    ];
    expect(stageAtClosing(transitions, "2026-08-17")).toBe("oportunidade");
    const decision = evaluateDailyClosing({ transitions, date: "2026-08-17" });
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toContain("OPORTUNIDADE");
  });

  it("§4 — só ZERO CONTATO e FRIO liberam cadência automática", () => {
    const eligible = evaluateDailyClosing({
      transitions: [{ stageKey: "frio", at: local("2026-08-17", 11) }],
      date: "2026-08-17",
    });
    expect(eligible.eligible).toBe(true);
    const novos = evaluateDailyClosing({
      transitions: [{ stageKey: "novos", at: local("2026-08-17", 11) }],
      date: "2026-08-17",
    });
    expect(novos.eligible).toBe(false);
  });

  it("§26 — OPORTUNIDADE é terminal", () => {
    expect(isTerminalStage("oportunidade")).toBe(true);
    expect(isTerminalStage("frio")).toBe(false);
  });
});

describe("§18–§20 — fluxo RF (relacionamento que esfriou)", () => {
  it("só existe com conversa real anterior e etapa FRIO", () => {
    expect(resolveCooledFlow({ stageKey: "frio", hadRealConversation: true })?.flow).toBe(
      "relacionamento_frio",
    );
    expect(resolveCooledFlow({ stageKey: "frio", hadRealConversation: false })).toBeNull();
    expect(resolveCooledFlow({ stageKey: "zero_contato", hadRealConversation: true })).toBeNull();
  });

  it("RF0 nunca no mesmo dia e RF1 encerra o fluxo", () => {
    expect(FLOW_SEQUENCE.relacionamento_frio).toEqual(["RF0", "RF1"]);
    expect(STEPS.RF0.businessDaysAfterReference).toBeGreaterThanOrEqual(1);
    expect(STEPS.RF1.terminal).toBe(true);
  });

  it("as mensagens RF reconhecem o histórico e não repetem primeiro contato", () => {
    expect(HOMOLOGATION_MESSAGES.RF0.text).toContain("combinado um horário");
    expect(HOMOLOGATION_MESSAGES.RF0.text).not.toContain("Recebi seu cadastro");
  });
});

describe("§21–§23 — conteúdo padrão de finalização", () => {
  it("existe um único grupo de finalização, exigido pela biblioteca", () => {
    expect(CONTENT_GROUPS).toContain("FINALIZACAO");
    expect(REQUIRED_CONTENT_GROUPS).toContain("FINALIZACAO");
  });

  it("E12, RE3 e RF1 usam o mesmo grupo e entregam o conteúdo em botão", () => {
    for (const step of ["E12", "RE3", "RF1"] as const) {
      expect(STEPS[step].contentGroup).toBe("FINALIZACAO");
      expect(HOMOLOGATION_MESSAGES[step].button).toBe("content");
      expect(HOMOLOGATION_MESSAGES[step].text).toContain("{{conteudo_final}}");
    }
  });

  it("os encerramentos não repetem o mesmo texto", () => {
    const texts = new Set(
      (["E12", "RE3", "RF1"] as const).map((s) => HOMOLOGATION_MESSAGES[s].text),
    );
    expect(texts.size).toBe(3);
  });
});