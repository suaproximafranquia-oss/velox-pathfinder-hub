/**
 * DEF 3.0.2 — ponte tipada entre o CRM (navegador) e o canal oficial da
 * Meta (servidor). Nenhuma regra de negócio vive aqui.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const dispatchWhatsappTemplate = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ phone: z.string(), investorName: z.string(), journeyId: z.string() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { sendOfficialTemplate } = await import("@/server/whatsapp.server");
    return sendOfficialTemplate(data);
  });

export const readWhatsappValidation = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ phone: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { readLatestValidation } = await import("@/server/whatsapp.server");
    return readLatestValidation(data.phone);
  });

/**
 * Adaptador interno de recebimento — equivalente exato ao Webhook da
 * Meta enquanto as credenciais oficiais não existem. Restrito à equipe
 * autenticada (Laboratório do Administrador).
 */
export const simulateWhatsappReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ phone: z.string(), status: z.enum(["confirmado", "recusado"]) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { recordReply } = await import("@/server/whatsapp.server");
    await recordReply({
      phone: data.phone,
      status: data.status,
      raw: { simulated: true, at: new Date().toISOString() },
    });
    return { ok: true as const };
  });