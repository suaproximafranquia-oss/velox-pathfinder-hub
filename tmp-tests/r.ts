import { renderFromLibrary } from "../src/server/relationship/message-library.server";
for (const s of ["E0","E1","E3","E20"]) {
  const r = await renderFromLibrary(s, { executiveName: "Thiago", portalLink: "https://x", rawInvestorName: "João Silva", contentName: "Material", contentUrl: "https://c" });
  console.log(s, JSON.stringify(r.result).slice(0,180));
}
