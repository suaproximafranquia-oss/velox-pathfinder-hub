import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateExecutiveSlug } from "@/lib/business-unit";
import { financeiraPublicUrl, investorPortalPath } from "@/lib/portal-brands";

export function executiveShortPortalUrl(slug: string): string | null {
  const checked = validateExecutiveSlug(slug);
  return checked.ok ? financeiraPublicUrl(investorPortalPath(checked.slug)) : null;
}

export const getMyExecutivePortalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ slug: string | null; url: string | null }> => {
    const { resolveServerIdentity } = await import("@/server/identity.server");
    const identity = await resolveServerIdentity(context.userId);
    const slug = identity.status === "ativo" ? identity.slug : null;
    return { slug, url: slug ? executiveShortPortalUrl(slug) : null };
  });

export const resolveExecutivePortalAlias = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().max(120) }).parse(data))
  .handler(async ({ data }): Promise<{ slug: string } | null> => {
    const checked = validateExecutiveSlug(data.slug);
    if (!checked.ok) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("executive_profiles")
      .select("executive_id,slug")
      .ilike("slug", checked.slug)
      .maybeSingle();
    if (!profile?.executive_id || !profile.slug) return null;
    const { data: status } = await supabaseAdmin
      .from("executive_user_status")
      .select("status")
      .eq("executive_id", profile.executive_id)
      .maybeSingle();
    if (status?.status === "inativo") return null;
    return { slug: profile.slug };
  });