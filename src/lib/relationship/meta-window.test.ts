import { describe, expect, it } from "vitest";
import { resolveMetaWindow } from "./meta-window";

const NOW = "2026-08-28T12:00:00.000Z";

describe("janela de 24h da Meta", () => {
  it("sem mensagem recebida, exige template", () => {
    const decision = resolveMetaWindow({ lastInboundAt: null, nowIso: NOW });
    expect(decision.open).toBe(false);
    expect(decision.channel).toBe("template");
  });

  it("dentro de 24h permite texto livre", () => {
    const decision = resolveMetaWindow({
      lastInboundAt: "2026-08-28T02:00:00.000Z",
      nowIso: NOW,
    });
    expect(decision.open).toBe(true);
    expect(decision.channel).toBe("texto_livre");
    expect(decision.remainingMs).toBeGreaterThan(0);
  });

  it("exatamente 24h já é janela fechada", () => {
    const decision = resolveMetaWindow({
      lastInboundAt: "2026-08-27T12:00:00.000Z",
      nowIso: NOW,
    });
    expect(decision.open).toBe(false);
    expect(decision.remainingMs).toBe(0);
  });

  it("data inválida é tratada como janela fechada", () => {
    const decision = resolveMetaWindow({ lastInboundAt: "não é data", nowIso: NOW });
    expect(decision.channel).toBe("template");
  });
});
