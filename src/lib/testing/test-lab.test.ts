import { describe, expect, it } from "vitest";
import {
  buildBatchId,
  buildIntakePayload,
  buildSyntheticLead,
  TEST_PHONE_PREFIX,
  TEST_SCENARIOS,
} from "./test-lab";

describe("lotes de teste em tempo real", () => {
  it("gera identificadores sequenciais por dia sem colidir", () => {
    const day = new Date("2026-08-21T12:00:00Z");
    expect(buildBatchId([], day)).toBe("TEST-20260821-A");
    expect(buildBatchId(["TEST-20260821-A"], day)).toBe("TEST-20260821-B");
    expect(buildBatchId(["TEST-20260820-A"], day)).toBe("TEST-20260821-A");
  });

  it("usa telefone não roteável e identidade própria do lote", () => {
    const lead = buildSyntheticLead("TEST-20260821-A", "silencio_total", 0);
    expect(lead.externalId).toBe("TEST-20260821-A-01");
    expect(lead.phone.startsWith(TEST_PHONE_PREFIX)).toBe(true);
    expect(lead.email.endsWith("@teste.velox.local")).toBe(true);
  });

  it("o cenário de telefone inválido não produz número plausível", () => {
    const lead = buildSyntheticLead("TEST-20260821-A", "telefone_invalido", 3);
    expect(lead.phone.replace(/\D/g, "").length).toBeLessThan(10);
  });

  it("entrega o payload no formato da origem, com a coluna de entrada", () => {
    const lead = buildSyntheticLead("TEST-20260821-A", "silencio_total", 0);
    const payload = buildIntakePayload(lead, "77", "2026-08-21T12:00:00.000Z");
    expect(payload["id"]).toBe(lead.externalId);
    expect(payload["tags"]).toEqual([{ id: "77" }]);
    expect(payload["last_register_at"]).toBe("2026-08-21T12:00:00.000Z");
  });

  it("mantém o catálogo de cenários sem chaves duplicadas", () => {
    const keys = TEST_SCENARIOS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
