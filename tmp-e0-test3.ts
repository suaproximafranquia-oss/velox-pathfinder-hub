import { kickoffPortalFirstContact } from "@/server/crm/portal-first-contact.server";
const { createPendingE0Action } = await import("@/server/crm/e0-actions.server");
const orig = createPendingE0Action;
const out = await kickoffPortalFirstContact({
  leadId: "ld_752e4c867b6b4b67b7c475b160f16937",
  name: "TEST META Canal",
  phone: "11980002",
  scope: "meta",
  ownerId: "usr_thiago",
  entryAt: new Date().toISOString(),
});
console.log("outcome:", out);
const r = await orig({ cardId: "ld_752e4c867b6b4b67b7c475b160f16937", origin: "meta", name: "x", whatsapp: "y" });
console.log("post:", JSON.stringify(r));
