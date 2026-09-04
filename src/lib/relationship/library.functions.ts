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
      contentUrl?: string | null;
      contentLabel?: string | null;
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
      contentUrl: data.contentUrl ?? null,
      contentLabel: data.contentLabel ?? null,
      actorId: context.userId,
      actorName: String(name),
    });
  });

/**
 * RÓTULO VISÍVEL DA ETAPA. Só apresentação: a chave técnica (E20, E27…)
 * permanece intocada no banco, na fila e no histórico.
 */
export const renomearRotuloEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stepKey: string; label: string }) => {
    if (!input?.stepKey) throw new Error("Etapa obrigatória.");
    return input;
  })
  .handler(async ({ data }) => {
    const { renameLibraryStep } = await import(
      "@/server/relationship/message-library.server"
    );
    return renameLibraryStep({ stepKey: data.stepKey, label: data.label ?? "" });
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
 * DIAGNÓSTICO DA BIBLIOTECA (somente leitura).
 * Mostra etapa ativa sem texto oficial e etapa cuja mensagem exige link
 * de conteúdo e está sem link configurado na versão ativa.
 */
export const diagnosticoDaBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { diagnoseLibrary } = await import(
      "@/server/relationship/library-diagnostics.server"
    );
    return diagnoseLibrary();
  });

/**
 * STATUS DA E0 — LEITURA PURA. Mostra ao executivo se o primeiro
 * contato saiu, ficou pendente ou foi bloqueado, com o motivo real
 * gravado no servidor. Nunca dispara nem reprocessa a E0.
 */
export const statusPrimeiroContato = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => {
    if (!input?.leadId) throw new Error("Lead obrigatório.");
    return input;
  })
  .handler(async ({ data }) => {
    const { readE0Status } = await import("@/server/relationship/e0-status.server");
    return readE0Status(data.leadId);
  });
