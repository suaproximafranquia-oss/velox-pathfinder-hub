import { describe, expect, it } from "vitest";
import {
  normalizeWhatsappNumber,
  whatsappLinkWithText,
  WHATSAPP_MISSING_REASON,
} from "./whatsapp-number";
import { resolveExecutionMode } from "./relationship/execution-mode";

describe("normalizeWhatsappNumber", () => {
  it("aceita número nacional com máscara e acrescenta o DDI do Brasil", () => {
    const result = normalizeWhatsappNumber("(17) 99772-7337");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.digits).toBe("5517997727337");
      expect(result.waLink).toBe("https://wa.me/5517997727337");
    }
  });

  it("mantém número já internacional", () => {
    const result = normalizeWhatsappNumber("+55 17 99772-7337");
    expect(result.valid && result.digits).toBe("5517997727337");
  });

  it("recusa vazio com motivo de cadastro ausente", () => {
    const result = normalizeWhatsappNumber("   ");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe(WHATSAPP_MISSING_REASON);
  });

  it("recusa número curto demais em vez de inventar dígitos", () => {
    expect(normalizeWhatsappNumber("99772").valid).toBe(false);
  });

  it("não gera link quando o número é inválido", () => {
    expect(whatsappLinkWithText("123", "olá")).toBeNull();
  });

  it("gera link com texto codificado", () => {
    expect(whatsappLinkWithText("17997727337", "Olá Velox")).toBe(
      "https://wa.me/5517997727337?text=Ol%C3%A1%20Velox",
    );
  });
});

describe("resolveExecutionMode", () => {
  it("homologação é sempre simulada", () => {
    expect(resolveExecutionMode({ production: false }).simulated).toBe(true);
  });

  it("lead de teste é simulado mesmo em produção", () => {
    expect(resolveExecutionMode({ production: true, isTestLead: true }).simulated).toBe(true);
  });

  it("produção com lead real executa de verdade", () => {
    const mode = resolveExecutionMode({ production: true, isTestLead: false });
    expect(mode.simulated).toBe(false);
    expect(mode.reason).toContain("canal oficial");
  });
});
