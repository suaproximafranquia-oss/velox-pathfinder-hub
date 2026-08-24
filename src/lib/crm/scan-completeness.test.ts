import { describe, expect, it } from "vitest";
import { evaluateScanCompleteness, type ScanState } from "./scan-completeness";

const okState: ScanState = {
  pagesExpected: 6,
  pagesScanned: 6,
  totalReported: 554,
  rowsReceived: 554,
  uniqueProcessed: 554,
  unexpectedEmptyPage: null,
};

describe("prova de completude da varredura", () => {
  it("aprova varredura íntegra (todas as páginas, total coerente)", () => {
    const result = evaluateScanCompleteness(okState);
    expect(result.complete).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("aborta quando falta página (resposta parcial da origem)", () => {
    const result = evaluateScanCompleteness({ ...okState, pagesScanned: 5 });
    expect(result.complete).toBe(false);
    expect(result.reason).toContain("Varredura parcial");
  });

  it("aborta quando a origem não informa paginação", () => {
    const result = evaluateScanCompleteness({ ...okState, pagesExpected: 0 });
    expect(result.complete).toBe(false);
  });

  it("aborta em página vazia fora de hora", () => {
    const result = evaluateScanCompleteness({ ...okState, unexpectedEmptyPage: 3 });
    expect(result.complete).toBe(false);
    expect(result.reason).toContain("página 3");
  });

  it("aborta quando a origem nunca declarou o total", () => {
    const result = evaluateScanCompleteness({ ...okState, totalReported: null });
    expect(result.complete).toBe(false);
    expect(result.reason).toContain("não declarou o total");
  });

  it("aborta quando o total declarado diverge do processado", () => {
    const result = evaluateScanCompleteness({
      ...okState,
      uniqueProcessed: 553,
      rowsReceived: 553,
    });
    expect(result.complete).toBe(false);
    expect(result.reason).toContain("Total incoerente");
  });

  it("duplicidade de ID no transporte não aprova varredura faltando linhas", () => {
    const result = evaluateScanCompleteness({
      ...okState,
      rowsReceived: 556,
      uniqueProcessed: 554,
    });
    expect(result.complete).toBe(true);
  });
});
