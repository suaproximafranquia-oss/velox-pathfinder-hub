/**
 * TESTE DE ENTRADA — 24 HORAS: porta de entrada da interface.
 *
 * Todas as operações são administrativas e exigem sessão autenticada
 * com perfil de administrador. Nada aqui envia mensagem: o worker do
 * servidor é quem executa as entradas no horário programado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(context: {
  supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}

export const resetHomologationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ dryRun: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context as never))) {
      return { ok: false as const, report: null, error: "Acesso restrito ao Administrador." };
    }
    const { resetHomologation } = await import("@/server/testing/batch24h.server");
    return { ok: true as const, report: await resetHomologation({ dryRun: data.dryRun }) };
  });

export const createBatch24hFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ seed: z.string().max(80).nullable().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context as never))) {
      return { ok: false as const, batchId: "", seed: "", events: [], error: "Acesso restrito ao Administrador." };
    }
    const { createBatch24h } = await import("@/server/testing/batch24h.server");
    return createBatch24h({
      seed: data.seed ?? null,
      createdBy: context.userId,
      createdByName: (context.claims as { email?: string })?.email ?? "administrador",
    });
  });

export const listBatches24hFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context as never))) return { ok: false as const, batches: [] };
    const { listBatches24h } = await import("@/server/testing/batch24h.server");
    return { ok: true as const, batches: await listBatches24h() };
  });

export const readBatch24hReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ batchId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context as never))) return { ok: false as const, report: null };
    const { readBatch24hReport } = await import("@/server/testing/batch24h.server");
    return { ok: true as const, report: await readBatch24hReport(data.batchId) };
  });

/** Execução manual do worker (o cron do CRM também o aciona). */
export const runBatch24hTickFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context as never))) {
      return { ok: false as const, executed: 0, skipped: 0, errors: ["Acesso restrito."] };
    }
    const { runBatch24hTick } = await import("@/server/testing/batch24h.server");
    return { ok: true as const, ...(await runBatch24hTick()) };
  });
