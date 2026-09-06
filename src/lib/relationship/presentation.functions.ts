/**
 * Ponte cliente ↔ servidor da APRESENTAÇÃO DIGITAL.
 *
 * A administração do roteiro depende de PERMISSÃO ADMINISTRATIVA — nunca
 * do cargo operacional. A verificação real acontece aqui no servidor; a
 * interface apenas reflete a mesma regra.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const permissaoApresentacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readAdministrativeAccess } = await import("@/server/authorization.server");
    const access = await readAdministrativeAccess(context as any);
    return { allowed: access.admin };
  });

export const listarCapitulos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { listCurrentChapters } = await import("@/server/relationship/presentation.server");
    return listCurrentChapters();
  });

export const salvarCapitulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      chapterKey?: string | null;
      title: string;
      description: string | null;
      videoUrl: string | null;
      thumbnailUrl: string | null;
      sortOrder: number;
      isActive: boolean;
      publish?: boolean;
    }) => {
      if (!input?.title?.trim()) throw new Error("Título obrigatório.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { saveChapter } = await import("@/server/relationship/presentation.server");
    const actorName = String((context.claims as Record<string, any> | null)?.["email"] ?? "Administrador");
    return saveChapter({
      chapterKey: data.chapterKey ?? null,
      title: data.title,
      description: data.description,
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      publish: data.publish !== false,
      actorId: context.userId,
      actorName,
    });
  });

export const listarRascunhos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { listDraftChapters } = await import("@/server/relationship/presentation.server");
    return listDraftChapters();
  });

export const publicarCapitulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chapterKey: string }) => {
    if (!input?.chapterKey) throw new Error("Capítulo obrigatório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { publishDraft } = await import("@/server/relationship/presentation.server");
    const actorName = String((context.claims as Record<string, any> | null)?.["email"] ?? "Administrador");
    return publishDraft({ chapterKey: data.chapterKey, actorId: context.userId, actorName });
  });

export const alternarCapitulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chapterKey: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { setChapterActive } = await import("@/server/relationship/presentation.server");
    return setChapterActive(data.chapterKey, data.active);
  });

export const reordenarCapitulos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { reorderChapters } = await import("@/server/relationship/presentation.server");
    return reorderChapters(data.order);
  });

export const versoesDoCapitulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chapterKey: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { listChapterVersions } = await import("@/server/relationship/presentation.server");
    return listChapterVersions(data.chapterKey);
  });

/** Pré-visualização: exatamente o roteiro que uma nova E20 congelaria. */
export const roteiroVigente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { currentScript } = await import("@/server/relationship/presentation.server");
    return currentScript();
  });

/**
 * APRESENTAÇÃO VIGENTE POR AMBIENTE (Financeira, Solar, Seguradora).
 *
 * Modelo simples e deliberado: UMA apresentação vigente por ambiente,
 * com texto de abertura e um vídeo. Não substitui nem interfere nos
 * capítulos versionados já usados pela Financeira — é uma camada
 * separada, e cada ambiente continua isolado.
 */
export const ENVIRONMENT_PRESENTATION_KEYS = ["financeira", "solar", "seguradora"] as const;
export type EnvironmentPresentationKey = (typeof ENVIRONMENT_PRESENTATION_KEYS)[number];

export const listarApresentacoesAmbiente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { listEnvironmentPresentations } = await import(
      "@/server/relationship/environment-presentation.server"
    );
    return listEnvironmentPresentations();
  });

export const salvarApresentacaoAmbiente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      environment: string;
      introText: string;
      videoUrl: string;
      isPublished: boolean;
    }) => {
      const environment = String(input.environment ?? "").trim();
      if (!ENVIRONMENT_PRESENTATION_KEYS.includes(environment as EnvironmentPresentationKey)) {
        throw new Error("Ambiente inválido para a apresentação.");
      }
      return {
        environment,
        introText: String(input.introText ?? "").trim(),
        videoUrl: String(input.videoUrl ?? "").trim(),
        isPublished: Boolean(input.isPublished),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { assertAdministrativeAccess } = await import("@/server/authorization.server");
    await assertAdministrativeAccess(context as any);
    const { saveEnvironmentPresentation } = await import(
      "@/server/relationship/environment-presentation.server"
    );
    return saveEnvironmentPresentation({
      ...data,
      actorId: (context as { userId?: string }).userId ?? null,
    });
  });
