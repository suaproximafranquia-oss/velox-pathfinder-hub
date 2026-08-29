/**
 * Ponte cliente ↔ servidor da APRESENTAÇÃO DIGITAL.
 *
 * A administração do roteiro depende de PERMISSÃO ADMINISTRATIVA — nunca
 * do cargo operacional. A verificação real acontece aqui no servidor; a
 * interface apenas reflete a mesma regra.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Área restrita à permissão administrativa.");
}

export const permissaoApresentacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { allowed: data === true };
  });

export const listarCapitulos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
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
    }) => {
      if (!input?.title?.trim()) throw new Error("Título obrigatório.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
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
      actorId: context.userId,
      actorName,
    });
  });

export const alternarCapitulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chapterKey: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { setChapterActive } = await import("@/server/relationship/presentation.server");
    return setChapterActive(data.chapterKey, data.active);
  });

export const reordenarCapitulos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order: string[] }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { reorderChapters } = await import("@/server/relationship/presentation.server");
    return reorderChapters(data.order);
  });

export const versoesDoCapitulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chapterKey: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { listChapterVersions } = await import("@/server/relationship/presentation.server");
    return listChapterVersions(data.chapterKey);
  });

/** Pré-visualização: exatamente o roteiro que uma nova E20 congelaria. */
export const roteiroVigente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { currentScript } = await import("@/server/relationship/presentation.server");
    return currentScript();
  });
