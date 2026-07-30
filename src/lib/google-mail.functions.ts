import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Envia um e-mail pela conta Google conectada do executivo. */
export const sendGoogleMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { to: string[]; subject: string; html: string }) => data)
  .handler(async ({ data, context }) => {
    const { sendMail } = await import("@/server/google-mail.server");
    return sendMail(context.userId, data);
  });