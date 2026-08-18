import { describe, expect, it } from "vitest";
import { resolveBoardColumn } from "./board";

/** Colunas reais do funil Velox Financeira, na ordem da origem. */
const COLUNAS = [
  { key: "novos", externalTag: "26", position: 1, isEntry: true },
  { key: "zero_contato", externalTag: "57", position: 2, isEntry: false },
  { key: "frio", externalTag: "7", position: 3, isEntry: false },
  { key: "agendamentos", externalTag: "28", position: 4, isEntry: false },
  { key: "remarketing", externalTag: "5", position: 9, isEntry: false },
  { key: "finalizado", externalTag: "19", position: 11, isEntry: false },
];

describe("board é a fonte da verdade", () => {
  it("TESTE 1 — NOVOS com etiqueta NOVOS", () => {
    const r = resolveBoardColumn(COLUNAS, ["26"]);
    expect(r.column?.key).toBe("novos");
    expect(r.remarketing).toBe(false);
  });

  it("TESTE 2 — NOVOS + REMARKETING continua em NOVOS, com indicador de recadastro", () => {
    const r = resolveBoardColumn(COLUNAS, ["26", "5"]);
    expect(r.column?.key).toBe("novos");
    expect(r.remarketing).toBe(true);
  });

  it("TESTE 3 — AGENDAMENTO com etiqueta NOVOS antiga não volta para NOVOS", () => {
    const r = resolveBoardColumn(COLUNAS, ["26", "28"]);
    expect(r.column?.key).toBe("agendamentos");
    expect(r.column?.isEntry).toBe(false);
  });

  it("TESTE 4 — etiquetas auxiliares não impedem nem alteram a coluna", () => {
    const r = resolveBoardColumn(COLUNAS, ["59", "71", "30", "7"]);
    expect(r.column?.key).toBe("frio");
  });

  it("apenas REMARKETING mantém o lead na coluna de remarketing", () => {
    const r = resolveBoardColumn(COLUNAS, ["5"]);
    expect(r.column?.key).toBe("remarketing");
    expect(r.remarketing).toBe(true);
  });

  it("nenhuma coluna reconhecida não é movimentação", () => {
    expect(resolveBoardColumn(COLUNAS, ["59", "71"]).column).toBeNull();
  });
});