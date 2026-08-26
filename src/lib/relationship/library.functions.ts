/**
 * Ponte cliente ↔ servidor da Biblioteca de Mensagens versionada e da
 * Jornada consolidada. Toda regra vive no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarMensagensBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listLibraryMessages } = await import(
      "@/server/relationship/message-library.server"
    );
    return listLibraryMessages();
  });

export const publicarVersaoMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      stepKey: string;
      body: string;
      title?: string | null;
      notes?: string | null;
    }) => {
      if (!input?.stepKey) throw new Error("Etapa obrigatória.");
      if (!input?.body?.trim()) throw new Error("O texto da mensagem não pode ficar vazio.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { publishLibraryVersion } = await import(
      "@/server/relationship/message-library.server"
    );
    const name = (context.claims as Record<string, any> | null)?.["email"] ?? "Executivo";
    return publishLibraryVersion({
      stepKey: data.stepKey,
      body: data.body,
      title: data.title ?? null,
      notes: data.notes ?? null,
      actorId: context.userId,
      actorName: String(name),
    });
  });

export const jornadaDoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => {
    if (!input?.leadId) throw new Error("Lead obrigatório.");
    return input;
  })
  .handler(async ({ data }) => {
    const { loadLeadJourney } = await import("@/server/relationship/journey.server");
    return loadLeadJourney(data.leadId);
  });

export const registrarNotaDoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; note: string }) => {
    if (!input?.leadId) throw new Error("Lead obrigatório.");
    if (!input?.note?.trim()) throw new Error("Escreva a nota antes de salvar.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { addLeadNote } = await import("@/server/relationship/journey.server");
    const name = (context.claims as Record<string, any> | null)?.["email"] ?? "Executivo";
    return addLeadNote({
      leadId: data.leadId,
      note: data.note,
      actorId: context.userId,
      actorName: String(name),
    });
  });
