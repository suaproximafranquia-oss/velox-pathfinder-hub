import { describe, it } from "vitest";
import { buildSimulatedLeads, runSimulation } from "@/lib/relationship/simulation";
import type { ValueContent } from "@/lib/relationship/content";
const lib: ValueContent[] = ["E1","E3","R1","R2"].flatMap((g)=>[1,2,3].map((i)=>({id:`${g}-${i}`,group:g,name:`C ${g}.${i}`,kind:"pdf" as const,url:"u",active:true,createdAt:"2026-08-01T12:00:00.000Z",updatedAt:"2026-08-01T12:00:00.000Z",usageCount:0})));
describe("dbg", () => { it("one", async () => {
  const lead = buildSimulatedLeads(300).find((l)=>l.leadId==="TEST-004")!;
  console.log(lead);
  const out = await runSimulation({runId:"D",leads:[lead],library:lib,executiveName:"Thiago",portalLink:"http://x"});
  console.log(JSON.stringify(out.leadResults[0]!.decisions,null,1));
}); });
