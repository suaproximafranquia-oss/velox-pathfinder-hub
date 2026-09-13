import { describe, expect, it } from "vitest";
import { isTemporaryDailyActionsReleaseActive } from "@/lib/crm/daily-actions-temporary-release";

describe("liberação temporária da Ação do Dia no /f", () => {
  it("libera somente em 13/09/2026 no horário de São Paulo", () => {
    expect(isTemporaryDailyActionsReleaseActive(new Date("2026-09-13T16:33:00-03:00"))).toBe(true);
  });

  it("expira exatamente antes de 14/09/2026 00:00:00 em São Paulo", () => {
    expect(isTemporaryDailyActionsReleaseActive(new Date("2026-09-13T23:59:59.999-03:00"))).toBe(true);
    expect(isTemporaryDailyActionsReleaseActive(new Date("2026-09-14T00:00:00-03:00"))).toBe(false);
  });

  it("não libera domingos fora da data excepcional", () => {
    expect(isTemporaryDailyActionsReleaseActive(new Date("2026-09-20T16:33:00-03:00"))).toBe(false);
  });
});