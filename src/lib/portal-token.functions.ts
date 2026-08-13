import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Emite o token de sessão do visitante do Portal.
 *
 * Só é emitido quando e-mail e telefone informados coincidem com o Lead
 * real já existente no banco — conhecer apenas o identificador não basta.
 */
export const issuePortalToken = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        investorId: z.string().min(3),
        email: z.string().min(3),
        phone: z.string().min(6),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ token: string } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { samePhone, issueToken } = await import("@/server/portal-token.server");
    const { data: row } = await supabaseAdmin
      .from("portal_leads")
      .select("id,email,whatsapp")
      .eq("id", data.investorId)
      .maybeSingle();
    if (!row) return null;
    const emailOk = (row.email ?? "").trim().toLowerCase() === data.email.trim().toLowerCase();
    if (!emailOk || !samePhone(row.whatsapp, data.phone)) return null;
    return { token: await issueToken(row.id) };
  });
