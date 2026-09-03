import { isE0NightWindow } from "@/lib/crm/e0-window";
import { isSimulatedExecution } from "@/server/relationship/execution-mode.server";
import { registerFirstContact } from "@/server/crm/first-contact.server";
console.log("janela noturna agora:", isE0NightWindow(), "| execução simulada:", isSimulatedExecution());
const r = await registerFirstContact({
  leadId: "ld_b8b6db51f921443ea2ce7da73dd533ad",
  name: "TEST TIKTOK Canal",
  phone: "11980001",
  origin: "TikTok",
  ownerId: "usr_thiago",
  entryAt: new Date().toISOString(),
  enteredEntryStageAt: new Date().toISOString(),
  entryOrigin: "PORTAL",
  simulated: isSimulatedExecution(),
});
console.log("registerFirstContact:", JSON.stringify(r));
