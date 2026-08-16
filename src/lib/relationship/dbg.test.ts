import { describe, it } from "vitest";
import { buildSimulatedLeads, runSimulation } from "@/lib/relationship/simulation";
import type { ValueContent } from "@/lib/relationship/content";
const lib: ValueContent[] = ["E1","E3","R1","R2"].flatMap((g)=>[1,2,3].map((i)=>({id:`${g}-${i}`,group:g,name:`C ${g}.${i}`,kind:"pdf" as const,url:"u",active:true,createdAt:"2026-08-01T12:00:00.000Z",updatedAt:"2026-08-01T12:00:00.000Z",usageCount:0})));
describe("dbg", () => { it("one", async () => {
  const leads = buildSimulatedLeads(300);
  const out = await runSimulation({runId:"D",leads,library:lib,executiveName:"Thiago",portalLink:"http://x"});
  const byScen: Record<string,{pass:number;fail:number;sample?:string}> = {};
  for (const r of out.leadResults) {
    const b = byScen[r.lead.scenario] ??= {pass:0,fail:0};
    if (r.result==="PASS") b.pass++; else { b.fail++; b.sample ??= `${r.lead.leadId} ${r.divergence}`; }
  }
  console.log(JSON.stringify(byScen,null,1));
}); });
