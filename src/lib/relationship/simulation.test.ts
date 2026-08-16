/**
 * Validação técnica do SIMULADOR BILATERAL (COMANDO 3A).
 * Nenhum acesso a banco, rede ou WhatsApp: apenas o motor em memória.
 */
import { describe, expect, it } from "vitest";
import { buildSimulatedLeads, runSimulation, SCENARIOS } from "./simulation";
import type { ValueContent } from "./content";

function library(): ValueContent[] {
  const groups = ["E1", "E3", "R1", "R2", "V3", "V4"];
  const items: ValueContent[] = [];
  for (const group of groups) {
    for (let i = 1; i <= 5; i += 1) {
      items.push({
        id: `${group}-${i}`,
        group,
        name: `HOMOLOGAÇÃO — CONTEÚDO DE TESTE ${group}.${i}`,
        kind: "pdf",
        url: `https://example.invalid/homologacao/${group}-${i}.pdf`,
        active: true,
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:00:00.000Z",
        usageCount: 0,
      });
    }
  }
  return items;
}

describe("simulador de homologação", () => {
  it("executa a jornada completa dos cenários sem divergência", async () => {
    const leads = buildSimulatedLeads(300);
    const out = await runSimulation({
      runId: "TEST-SPEC",
      leads,
      library: library(),
      executiveName: "Thiago Rodrigues",
      portalLink: "https://exemplo.invalido/f/thiago-rodrigues",
    });

    const failures = out.leadResults.filter((r) => r.result === "FAIL");
    if (failures.length > 0) {
      // Divergência nunca é mascarada.
      console.error(
        failures.slice(0, 5).map((f) => `${f.lead.leadId} ${f.lead.scenario}: ${f.divergence}`),
      );
    }
    expect(leads.length).toBe(300);
    expect(failures.length).toBe(0);
    expect(out.outsideBusinessHours.length).toBe(0);
    expect(Object.keys(SCENARIOS).length).toBe(10);
  });
});