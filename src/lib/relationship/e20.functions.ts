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

/**
 * ESTADOS INDEPENDENTES (§10): copiar NUNCA significa enviar. Cada clique
 * registra apenas o fato ocorrido.
 */
export const registrarCopiaE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; occurrenceId: string; kind: "mensagem" | "link" }) => {
    if (!input?.leadId || !input?.occurrenceId) throw new Error("Ocorrência obrigatória.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { logE20Event } = await import("@/server/relationship/e20.server");
    const actorName = String((context.claims as Record<string, any> | null)?.["email"] ?? "Executivo");
    await logE20Event({
      leadId: data.leadId,
      occurrenceId: data.occurrenceId,
      event: data.kind === "mensagem" ? "mensagem_copiada" : "link_copiado",
      actorId: context.userId,
      actorName,
    });
    return { ok: true as const };
  });

/** Encerramento manual — motivo obrigatório, autor e horário registrados. */
export const encerrarE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { occurrenceId: string; reason: string }) => {
    if (!input?.occurrenceId) throw new Error("Ocorrência obrigatória.");
    if (!input?.reason?.trim()) throw new Error("Motivo obrigatório para encerrar a apresentação.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { closeE20Manually } = await import("@/server/relationship/e20.server");
    const actorName = String((context.claims as Record<string, any> | null)?.["email"] ?? "Executivo");
    return closeE20Manually({
      occurrenceId: data.occurrenceId,
      reason: data.reason,
      actorId: context.userId,
      actorName,
    });
  });

/** Aberturas e trilha de estados de um lead — leitura da ficha. */
export const auditoriaE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => input)
  .handler(async ({ data }) => {
    const { listE20Accesses, listE20Events } = await import(
      "@/server/relationship/e20.server"
    );
    const [accesses, events] = await Promise.all([
      listE20Accesses(data.leadId),
      listE20Events(data.leadId),
    ]);
    return { accesses, events };
  });

/** Mensagem oficial já congelada da emissão vigente (Biblioteca). */
export const mensagemDaE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; occurrenceId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("relationship_message_sends")
      .select("rendered_body,library_version")
      .eq("lead_id", data.leadId)
      .eq("occurrence_id", data.occurrenceId)
      .eq("step", "E20")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) {
      return {
        body: null,
        version: null,
        reason:
          "O texto oficial da E20 ainda não está publicado na Biblioteca. Nenhum texto alternativo é gerado.",
      };
    }
    return {
      body: (row as any).rendered_body as string,
      version: ((row as any).library_version as number | null) ?? null,
      reason: null,
    };
  });

/**
 * ENVIO CONFIRMADO: declaração humana e explícita. O sistema jamais
 * presume envio a partir de um clique em "copiar".
 */
export const marcarEnvioE20 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { occurrenceId: string }) => {
    if (!input?.occurrenceId) throw new Error("Ocorrência obrigatória.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { markE20Sent } = await import("@/server/relationship/e20.server");
    const actorName = String((context.claims as Record<string, any> | null)?.["email"] ?? "Executivo");
    return markE20Sent({
      occurrenceId: data.occurrenceId,
      actorId: context.userId,
      actorName,
    });
  });
