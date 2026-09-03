import { createPendingE0Action } from "@/server/crm/e0-actions.server";
const r = await createPendingE0Action({
  cardId: "ld_a4f0d2179454499296ddfb9674bcc716",
  origin: "tiktok",
  name: "TEST TIKTOK Canal",
  whatsapp: "11980001",
  responsibleExecutiveId: "usr_thiago",
  entryAt: new Date().toISOString(),
});
console.log(JSON.stringify(r));
