import { buildSimulatedLeads, runSimulation, SCENARIOS } from "../src/lib/relationship/simulation";
import type { ValueContent } from "../src/lib/relationship/content";

const now = new Date().toISOString();
const mk = (g: string, i: number, kind: ValueContent["kind"]): ValueContent => ({
  id: `${g}-${i}`, group: g, name: `${g} · material ${i}`, kind,
  url: `https://materiais.velox.com.br/${g.toLowerCase()}-${i}`,
  active: true, createdAt: now, updatedAt: now, usageCount: 0,
});
const library = [
  mk("E1", 1, "pdf"), mk("E1", 2, "video"),
  mk("E3", 1, "documento"), mk("E3", 2, "apresentacao"),
  mk("R1", 1, "imagem"), mk("R1", 2, "pdf"),
  mk("R2", 1, "video"), mk("R2", 2, "arquivo"),
];
const out = await runSimulation({
  runId: "DRY-RUN",
  leads: buildSimulatedLeads(300),
  library,
  executiveName: "Thiago Rodrigues",
  portalLink: "https://portal.velox.com.br/f/thiago-rodrigues",
});
const pass = out.leadResults.filter(r => r.result === "PASS").length;
console.log("leads", out.leadResults.length, "PASS", pass, "FAIL", out.leadResults.length - pass);
for (const k of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]) {
  const l = out.leadResults.filter(r => r.lead.scenario === k);
  console.log(k, SCENARIOS[k].name, "|esperado", SCENARIOS[k].expectedSteps.join("→"),
    "|conformes", l.filter(r => r.result === "PASS").length + "/" + l.length,
    l.find(r => r.result === "FAIL")?.divergence ?? "");
}
console.log("mensagens", out.messages.length,
  "| com conteúdo", out.messages.filter(m => m.contentId).length,
  "| fora de horário", out.outsideBusinessHours.length,
  "| bloqueios", out.decisions.filter(d => d.outcome === "blocked").length,
  "| agendamentos", out.leadResults.filter(r => r.scheduled).length,
  "| visualizações", out.leadResults.reduce((n, r) => n + r.reads, 0),
  "| respostas", out.leadResults.reduce((n, r) => n + r.responses, 0));
console.log("uso por conteúdo", out.contentUsage);
