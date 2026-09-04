/**
 * Acesso da interface às Ações do Dia.
 * Somente gestão autenticada; o navegador nunca fala com a origem.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DailyAction, DailyActionsSummary } from "@/lib/crm/daily-actions";

async function assertManager(context: { supabase: never; userId: string }) {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const [admin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!admin.data && !manager.data) throw new Error("Acesso restrito à gestão do CRM.");
}

async function currentExecutiveId(context: { supabase: never }): Promise<string | null> {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const { data } = await supabase.rpc("current_executive_id");
  return typeof data === "string" && data ? data : null;
}

/** Lista única do dia — recalculada a cada leitura a partir das fontes. */
export const listDailyActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyAction[]> => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { buildDailyActions } = await import("@/server/crm/daily-actions.server");
    return buildDailyActions({ executiveId });
  });

/** Contador discreto do botão: atrasadas x hoje x reuniões. */
export const getDailyActionsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyActionsSummary> => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { buildDailyActions } = await import("@/server/crm/daily-actions.server");
    const { summarizeDailyActions } = await import("@/lib/crm/daily-actions");
    return summarizeDailyActions(await buildDailyActions({ executiveId }));
  });

/** Dados mínimos de identificação da ação, vindos da própria lista. */
type ActionRefInput = {
  actionKey: string;
  leadId: string | null;
  kind: string;
  step: string | null;
  title: string;
  reason: string;
};

/**
 * PULAR COM JUSTIFICATIVA. A obrigação não desaparece do histórico:
 * fica registrada com autor, horário, investidor, etapa e motivo.
 */
export const skipDailyActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ActionRefInput) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { skipDailyAction } = await import("@/server/crm/daily-actions-log.server");
    await skipDailyAction({ ...data, userId: context.userId, executiveId });
    return { ok: true as const };
  });

/** OBSERVAÇÃO operacional, no mesmo histórico oficial. */
export const noteDailyActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ActionRefInput) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { noteDailyAction } = await import("@/server/crm/daily-actions-log.server");
    await noteDailyAction({ ...data, userId: context.userId, executiveId });
    return { ok: true as const };
  });

/**
 * MENSAGEM OFICIAL DA ETAPA — somente leitura da Biblioteca ativa.
 * Não envia, não altera cadência e não cria texto novo.
 */
export const getDailyActionMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { leadId: string; step: string; leadName?: string | null }) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { prepareStepMessage } = await import("@/server/relationship/step-message.server");
    return prepareStepMessage({
      leadId: data.leadId,
      step: data.step,
      leadName: data.leadName ?? null,
    });
  });

/** Registro de que a mensagem foi tratada pela interface (sem envio real). */
export const registerDailyActionMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ActionRefInput) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { registerDailyActionMessage } = await import(
      "@/server/crm/daily-actions-log.server"
    );
    const outcome = await registerDailyActionMessage({
      ...data,
      userId: context.userId,
      executiveId,
    });
    return { ok: true as const, ...outcome };
  });

/** Desfecho da reunião, resolvido na fonte oficial `portal_meetings`. */
export const resolveMeetingOutcomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      meetingId: string;
      attended: boolean;
      note: string;
      leadId: string | null;
      actionKey: string;
      title: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { resolveMeetingOutcome } = await import("@/server/crm/daily-actions-log.server");
    await resolveMeetingOutcome({ ...data, userId: context.userId, executiveId });
    return { ok: true as const };
  });

/** Reagendamento da reunião — mesma reunião, nova data. */
export const rescheduleMeetingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      meetingId: string;
      scheduledAt: string;
      note: string;
      leadId: string | null;
      actionKey: string;
      title: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { rescheduleMeeting } = await import("@/server/crm/daily-actions-log.server");
    await rescheduleMeeting({ ...data, userId: context.userId, executiveId });
    return { ok: true as const };
  });
