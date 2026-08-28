/**
 * Ponte cliente ↔ servidor da E20 e do contato do executivo.
 * Toda regra vive no servidor; aqui só existe a chamada tipada.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Estado da Apresentação Digital para a ficha do investidor: convite
 * vigente (se houver) e histórico. A ficha nunca decide sozinha se um
 * link ainda vale — quem responde é o servidor.
 */
export const estadoE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => {
    if (!input?.leadId) throw new Error("Lead obrigatório.");
    return input;
  })
  .handler(async ({ data }) => {
    const { currentE20, listE20Occurrences } = await import(
      "@/server/relationship/e20.server"
    );
    const [current, history] = await Promise.all([
      currentE20(data.leadId),
      listE20Occurrences(data.leadId),
    ]);
    return { current, history };
  });

export const emitirE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; baseUrl: string; force?: boolean }) => {
    if (!input?.leadId) throw new Error("Lead obrigatório.");
    if (!input?.baseUrl) throw new Error("Endereço base obrigatório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { currentE20, issueE20 } = await import("@/server/relationship/e20.server");

    /**
     * REUTILIZAÇÃO DA OCORRÊNCIA VIGENTE: sem pedido explícito de novo
     * convite, um link ativo é devolvido como está. Isso evita encerrar
     * o convite que o investidor já recebeu e abrir uma instância de
     * cadência duplicada por um clique repetido.
     */
    if (!data.force) {
      const active = await currentE20(data.leadId);
      if (active) {
        return {
          issued: true as const,
          reused: true as const,
          occurrence: active,
          replaced: null,
          message: null,
          messageBlockedReason: null,
        };
      }
    }

    const name = (context.claims as Record<string, any> | null)?.["email"] ?? "Executivo";
    const result = await issueE20({
      leadId: data.leadId,
      baseUrl: data.baseUrl,
      generatedBy: context.userId,
      generatedByName: String(name),
    });
    return { ...result, reused: false as const };
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
  .inputValidator((input: { token: string; userAgent?: string | null }) => input)
  .handler(async ({ data }) => {
    const { redeemE20 } = await import("@/server/relationship/e20.server");
    return redeemE20(data.token, data.userAgent ?? null);
  });
