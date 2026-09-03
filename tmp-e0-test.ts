import { resolvePortalIdentity } from "@/lib/portal-identity.functions";
const stamp = Date.now().toString().slice(-6);
for (const ch of ["tiktok", "meta"] as const) {
  const r = await (resolvePortalIdentity as any)({
    data: {
      name: `TEST ${ch.toUpperCase()} Canal`,
      email: `test.${ch}.${stamp}@velox.test`,
      phone: `1198${stamp}0`,
      origin: ch === "tiktok" ? "TikTok" : "Meta",
      material: "Portal do Investidor",
      scope: ch,
      executiveId: "usr_thiago",
      executiveSlug: null,
      personalized: false,
      campaign: null,
      device: "test",
    },
  });
  console.log(ch, JSON.stringify(r));
}
