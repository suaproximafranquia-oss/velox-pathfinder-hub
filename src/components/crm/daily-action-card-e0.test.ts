import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./daily-action-card.tsx", import.meta.url), "utf8");

describe("Ação do Dia — primeira ligação E0 atendida", () => {
  it("exibe a decisão explícita e carrega CONTATO_REALIZADO", () => {
    expect(source).toContain("Deseja copiar a mensagem da etapa E0?");
    expect(source).toContain('handleOpenMessage("CONTATO_REALIZADO")');
  });

  it("copiar não registra nem conclui; Concluído conclui a ligação", () => {
    const copyHandler = source.slice(
      source.indexOf("async function copyMessageBody"),
      source.indexOf("function handleRegisterMessage"),
    );
    expect(copyHandler).not.toContain("registerMessage(");
    expect(copyHandler).not.toContain("completeCall(");
    expect(source).toContain('completeCall("SIM", true)');
  });
});