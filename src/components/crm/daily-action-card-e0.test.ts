import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  dailyActionWhatsappUrl,
  openDailyActionWhatsapp,
} from "./daily-action-card";

const source = readFileSync(new URL("./daily-action-card.tsx", import.meta.url), "utf8");

describe("Ação do Dia — mensagem após ligação", () => {
  it("carrega CONTATO_REALIZADO para todo resultado positivo", () => {
    expect(source).toContain('callPending.outcome === "SIM"');
    expect(source).toContain('? "CONTATO_REALIZADO"');
  });

  it("copiar não registra nem conclui; Concluído conclui a ligação", () => {
    const copyHandler = source.slice(
      source.indexOf("async function copyMessageBody"),
      source.indexOf("function handleRegisterMessage"),
    );
    expect(copyHandler).not.toContain("registerMessage(");
    expect(copyHandler).not.toContain("completeCall(");
    expect(source).toContain("completeCallAndMessage(item, outcome, rang, observation)");
  });

  it("B) a cópia de CONTATO_REALIZADO permanece separada da conclusão", () => {
    const copyHandler = source.slice(
      source.indexOf("async function copyMessageBody"),
      source.indexOf("function handleRegisterMessage"),
    );
    expect(copyHandler).toContain("copyToClipboard");
    expect(copyHandler).not.toContain('completeCall("SIM"');
  });

  it("I) CONTATO_REALIZADO continua carregado pela fonte oficial existente", () => {
    expect(source).toContain('adapter.loadMessage(item, context)');
    expect(source).toContain('? "CONTATO_REALIZADO"');
  });

  it("abre telefone brasileiro válido no contato do WhatsApp", () => {
    expect(dailyActionWhatsappUrl("+55 67 99278-6242")).toBe(
      "https://api.whatsapp.com/send?phone=5567992786242",
    );
  });

  it("acrescenta o DDI ao telefone brasileiro sem +55", () => {
    expect(dailyActionWhatsappUrl("67992786242")).toBe(
      "https://api.whatsapp.com/send?phone=5567992786242",
    );
  });

  it("remove a máscara pela normalização central existente", () => {
    expect(dailyActionWhatsappUrl("(67) 99278-6242")).toBe(
      "https://api.whatsapp.com/send?phone=5567992786242",
    );
  });

  it("não abre URL quando o telefone está ausente ou inválido", () => {
    const openWindow = vi.fn();
    expect(openDailyActionWhatsapp("", openWindow)).toBe(false);
    expect(openDailyActionWhatsapp("123", openWindow)).toBe(false);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("abre nova aba segura sem texto e sem executar a ação", () => {
    const openWindow = vi.fn();
    expect(openDailyActionWhatsapp("(67) 99278-6242", openWindow)).toBe(true);
    expect(openWindow).toHaveBeenCalledOnce();
    expect(openWindow).toHaveBeenCalledWith(
      "https://api.whatsapp.com/send?phone=5567992786242",
      "_blank",
      "noopener,noreferrer",
    );
    expect(openWindow.mock.calls[0]?.[0]).not.toContain("text=");

    const whatsappHandler = source.slice(
      source.indexOf("function handleOpenWhatsapp"),
      source.indexOf("function handleRegisterMessage"),
    );
    expect(whatsappHandler).not.toContain("completeCallAndMessage(");
    expect(whatsappHandler).not.toContain("registerMessage(");
    expect(whatsappHandler).not.toContain("setMessageOpen(false)");
  });

  it("preserva copiar, concluir, fechar e a ficha completa do card principal", () => {
    expect(source).toContain('aria-label="Fechar mensagem"');
    expect(source).toContain("copyMessageBody(message?.body)");
    expect(source).toContain("completeCallAndMessage(callPending.outcome, callPending.rang)");
    expect(source).toContain("<ExternalLink className=\"h-4 w-4\" /> Ver ficha completa");
    expect(source.match(/Ver ficha completa/g)).toHaveLength(2);
    expect(source).toContain("Telefone não disponível para abrir o WhatsApp.");
  });
});