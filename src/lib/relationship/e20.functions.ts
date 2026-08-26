/**
 * Ponte cliente ↔ servidor da E20 e do contato do executivo.
 * Toda regra vive no servidor; aqui só existe a chamada tipada.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const emitirE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; baseUrl: string }) => {
    if (!input?.leadId) throw new Error("Lead obrigatório.");
    if (!input?.baseUrl) throw new Error("Endereço base obrigatório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { issueE20 } = await import("@/server/relationship/e20.server");
    const name =
      (context.claims as Record<string, any> | null)?.["email"] ?? "Executivo";
    return issueE20({
      leadId: data.leadId,
      baseUrl: data.baseUrl,
      generatedBy: context.userId,
      generatedByName: String(name),
    });
  });

export const listarOcorrenciasE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => input)
  .handler(async ({ data }) => {
    const { listE20Occurrences } = await import("@/server/relationship/e20.server");
    return listE20Occurrences(data.leadId);
  });

/** Público: o Portal precisa saber se há executivo para conversar. */
export const contatoDoExecutivo = createServerFn({ method: "POST" })
  .inputValidator((input: { leadId: string }) => input)
  .handler(async ({ data }) => {
    const { resolveExecutiveContact } = await import(
      "@/server/relationship/executive-contact.server"
    );
    return resolveExecutiveContact(data.leadId);
  });

/** Público: resgate do convite de 7 dias. */
export const resgatarConviteE20 = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { redeemE20 } = await import("@/server/relationship/e20.server");
    return redeemE20(data.token);
  });
