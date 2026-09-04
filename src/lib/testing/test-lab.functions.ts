/**
 * LABORATÓRIO DE CADÊNCIA EM TEMPO REAL — porta de entrada da interface.
 *
 * Todas as operações exigem sessão autenticada e perfil de administrador:
 * criar lotes fictícios, observar e limpar são atos administrativos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: {
  supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return Boolean(data);
}

export const listTestBatchesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await assertAdmin(context as never))) return { ok: false as const, batches: [] };
    const { listTestBatches } = await import("@/server/testing/test-lab.server");
    return { ok: true as const, batches: await listTestBatches() };
  });

export const readBatchLeadsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ batchId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await assertAdmin(context as never))) return { ok: false as const, leads: [] };
    const { readBatchLeads } = await import("@/server/testing/test-lab.server");
    return { ok: true as const, leads: await readBatchLeads(data.batchId) };
  });

export const createTestBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        scenarios: z.array(z.string().min(1)).min(1),
        perScenario: z.number().int().min(1).max(10),
        notes: z.string().max(500).nullable().optional(),
        /** Executivo responsável dos leads do lote (opcional). */
        responsibleExecutiveId: z.string().min(1).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertAdmin(context as never))) {
      return { ok: false as const, batchId: "", leads: [], errors: ["Acesso restrito ao Administrador."] };
    }
    const { createTestBatch } = await import("@/server/testing/test-lab.server");
    return createTestBatch({
      scenarios: data.scenarios as never,
      perScenario: data.perScenario,
      notes: data.notes ?? null,
      createdBy: context.userId,
      createdByName: (context.claims as { email?: string })?.email ?? "administrador",
    });
  });

export const applyBatchActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        batchId: z.string().min(1),
        externalId: z.string().min(1),
        action: z.enum(["responder", "agendar", "interromper", "avancar_etapa"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertAdmin(context as never))) {
      return { ok: false as const, message: "Acesso restrito ao Administrador." };
    }
    const { applyBatchAction } = await import("@/server/testing/test-lab.server");
    return applyBatchAction(data);
  });

export const purgeTestBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ batchId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await assertAdmin(context as never))) return { ok: false as const, removed: 0 };
    const { purgeTestBatch } = await import("@/server/testing/test-lab.server");
    return purgeTestBatch(data.batchId);
  });
