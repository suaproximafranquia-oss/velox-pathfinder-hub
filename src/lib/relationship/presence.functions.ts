/**
 * Ponte cliente ↔ servidor da presença do investidor.
 * A regra vive no servidor; a interface apenas exibe o que for real.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const presencaDoInvestidor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => {
    if (!input?.leadId) throw new Error("Lead obrigatório.");
    return input;
  })
  .handler(async ({ data }) => {
    const { resolveInvestorPresence } = await import(
      "@/server/relationship/presence.server"
    );
    return resolveInvestorPresence(data.leadId);
  });
