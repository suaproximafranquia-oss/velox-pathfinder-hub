import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { kickoffPortalFirstContact } from "@/server/crm/portal-first-contact.server";
const stamp = Date.now().toString().slice(-6);
for (const ch of ["tiktok", "meta"] as const) {
  const { data, error } = await supabaseAdmin.rpc("resolve_portal_identity", {
    _name: `TEST ${ch.toUpperCase()} Canal`,
    _email: `test.${ch}.${stamp}@velox.test`,
    _phone: `1198${stamp}0`,
    _origin: ch === "tiktok" ? "TikTok" : "Meta",
    _material: "Portal do Investidor",
    _scope: ch,
    _executive_id: "usr_thiago",
    _executive_slug: null,
    _personalized: false,
    _campaign: null,
    _device: "test",
    _city: "",
  } as never);
  console.log(ch, "rpc:", JSON.stringify(data), error?.message ?? "");
  const payload = (data ?? {}) as any;
  if (payload.created) {
    const out = await kickoffPortalFirstContact({
      leadId: payload.leadId,
      name: `TEST ${ch.toUpperCase()} Canal`,
      phone: `1198${stamp}0`,
      scope: ch,
      ownerId: "usr_thiago",
      entryAt: new Date().toISOString(),
    });
    console.log(ch, "e0:", out);
  }
}
