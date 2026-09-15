import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

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
});