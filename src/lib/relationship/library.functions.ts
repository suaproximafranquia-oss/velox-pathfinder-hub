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
      bodyWithoutName?: string | null;
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
      bodyWithoutName: data.bodyWithoutName ?? null,
      title: data.title ?? null,
      notes: data.notes ?? null,
      actorId: context.userId,
      actorName: String(name),
    });
  });

/**
 * Importa/atualiza a Biblioteca a partir do Word oficial. Texto igual ao
 * que já está ativo não gera versão nova; texto diferente cria a versão
 * seguinte e preserva a anterior.
 */
export const importarBibliotecaOficial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { importWordLibrary } = await import(
      "@/server/relationship/message-library.server"
    );
    const name = (context.claims as Record<string, any> | null)?.["email"] ?? "Executivo";
    return importWordLibrary({ actorId: context.userId, actorName: String(name) });
  });


export const jornadaDoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; layer?: "relacional" | "tecnico" | "todos" }) => {
    if (!input?.leadId) throw new Error("Lead obrigatório.");
    return input;
  })
  .handler(async ({ data }) => {
    const { loadLeadJourney } = await import("@/server/relationship/journey.server");
    return loadLeadJourney(data.leadId, { layer: data.layer ?? "relacional" });
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

/**
 * VÍNCULO EXPLÍCITO ETAPA ↔ CONTEÚDO (VÍDEO). A Biblioteca de
 * Conteúdos permanece a mesma: aqui apenas se declara qual material
 * dela pertence a cada etapa. Nada é duplicado.
 */
export const listarConteudosDaBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listValueContents } = await import("@/server/relationship/homologation.server");
    return listValueContents();
  });

export const listarVinculosDeEtapa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listStepContentBindings } = await import(
      "@/server/relationship/step-media.server"
    );
    return listStepContentBindings();
  });

export const vincularConteudoAEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stepKey: string; contentId: string; notes?: string | null }) => {
    if (!input?.stepKey) throw new Error("Etapa obrigatória.");
    if (!input?.contentId) throw new Error("Selecione o conteúdo da Biblioteca.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { setStepContentBinding } = await import(
      "@/server/relationship/step-media.server"
    );
    const name = (context.claims as Record<string, any> | null)?.["email"] ?? "Executivo";
    return setStepContentBinding({
      stepKey: data.stepKey,
      contentId: data.contentId,
      notes: data.notes ?? null,
      actorId: context.userId,
      actorName: String(name),
    });
  });

export const removerVinculoDeEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stepKey: string }) => {
    if (!input?.stepKey) throw new Error("Etapa obrigatória.");
    return input;
  })
  .handler(async ({ data }) => {
    const { clearStepContentBinding } = await import(
      "@/server/relationship/step-media.server"
    );
    return clearStepContentBinding(data.stepKey);
  });
