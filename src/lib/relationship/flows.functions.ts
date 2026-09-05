/**
 * BLOCO 4 — Ponte cliente ↔ servidor da configuração de FLUXOS.
 *
 * Somente administração (admin/gestor) enxerga e altera versões. Toda a
 * regra — imutabilidade da versão publicada, congelamento por ciclo —
 * vive no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const [{ data: admin }, { data: manager }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!admin && !manager) throw new Error("Acesso restrito à administração.");
}

export const listarFluxos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const mod = await import("@/server/relationship/flow-versions.server");
    const flows = await Promise.all(
      mod.FLOW_KEYS.map(async (flow) => ({
        flowKey: flow,
        versions: await mod.listFlowVersions(flow),
      })),
    );
    return flows;
  });

export const detalharVersaoFluxo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => {
    if (!input?.versionId) throw new Error("Versão obrigatória.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { getFlowVersionDetail } = await import(
      "@/server/relationship/flow-versions.server"
    );
    return getFlowVersionDetail(data.versionId);
  });

export const criarRascunhoFluxo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { flow: string; copyFromVersionId?: string | null }) => {
    if (!input?.flow) throw new Error("Fluxo obrigatório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { createFlowDraft } = await import("@/server/relationship/flow-versions.server");
    return createFlowDraft({ flow: data.flow, copyFromVersionId: data.copyFromVersionId ?? null });
  });

export const salvarRascunhoFluxo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      versionId: string;
      steps: Array<{ stepKey: string; businessDaysAfterReference: number; active: boolean }>;
    }) => {
      if (!input?.versionId) throw new Error("Versão obrigatória.");
      if (!Array.isArray(input.steps)) throw new Error("Configuração inválida.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { saveFlowDraftSteps } = await import(
      "@/server/relationship/flow-versions.server"
    );
    return saveFlowDraftSteps({ versionId: data.versionId, steps: data.steps });
  });

export const publicarVersaoFluxo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { versionId: string }) => {
    if (!input?.versionId) throw new Error("Versão obrigatória.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { publishFlowVersion } = await import(
      "@/server/relationship/flow-versions.server"
    );
    return publishFlowVersion({ versionId: data.versionId, publishedBy: context.userId });
  });

/** Etapas disponíveis para associação: a Biblioteca é dona da existência. */
export const etapasDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listLibraryMessages } = await import(
      "@/server/relationship/message-library.server"
    );
    const messages = await listLibraryMessages();
    return messages.map((m: any) => ({
      stepKey: m.stepKey,
      title: m.title ?? null,
    }));
  });
