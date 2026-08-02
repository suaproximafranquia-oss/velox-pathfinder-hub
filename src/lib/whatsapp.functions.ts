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