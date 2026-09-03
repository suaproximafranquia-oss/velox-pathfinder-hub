import { resolveExecutiveE0Mode } from "@/server/crm/first-contact-mode.server";
console.log("thiago:", JSON.stringify(await resolveExecutiveE0Mode("usr_thiago")));
console.log("sem responsável:", JSON.stringify(await resolveExecutiveE0Mode(null)));
