/**
 * Validação técnica do SIMULADOR BILATERAL (COMANDO 3A).
 * Nenhum acesso a banco, rede ou WhatsApp: apenas o motor em memória.
 */
import { describe, expect, it } from "vitest";
import { buildSimulatedLeads, runSimulation, SCENARIOS } from "./simulation";

describe("simulador de homologação", () => {
  it("executa a jornada completa dos cenários sem divergência", async () => {
    const leads = buildSimulatedLeads(300);
    const out = await runSimulation({
      runId: "TEST-SPEC",
      leads,
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

  /** COMANDO 3C §3 — cada rodada sorteia conteúdos de forma independente. */
  it("reproduz a rodada: a escolha de conteúdo é determinística em qualquer semente", async () => {
    const leads = buildSimulatedLeads(20);
    const base = {
      leads,
      executiveName: "Thiago Rodrigues",
      portalLink: "https://exemplo.invalido/f/thiago-rodrigues",
    };
    // Não existe mais escolha de conteúdo: o link pertence à mensagem.
    // O que precisa ser reproduzível é a sequência de mensagens.
    const contents = (out: Awaited<ReturnType<typeof runSimulation>>) =>
      out.messages.map((m) => `${m.leadId}:${m.step}:${m.button?.url ?? ""}`);

    const a = await runSimulation({ ...base, runId: "TEST-SEED-A", seed: 111 });
    const b = await runSimulation({ ...base, runId: "TEST-SEED-B", seed: 111 });
    const c = await runSimulation({ ...base, runId: "TEST-SEED-C", seed: 999 });

    expect(a.seed).toBe(111);
    expect(contents(a)).toEqual(contents(b));
    expect(contents(a).length).toBeGreaterThan(0);
    // A semente não altera o link: ele vem sempre da própria mensagem.
    expect(contents(a)).toEqual(contents(c));
  });
});