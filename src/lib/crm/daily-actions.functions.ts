/**
 * Acesso da interface às Ações do Dia.
 * Somente gestão autenticada; o navegador nunca fala com a origem.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

/**
 * Lista única do dia — recalculada a cada leitura a partir das fontes.
 * A leitura passa pela MESMA trava do servidor: a interface informa o
 * único card ativo e a primeira ação elegível continua sendo reivindicada.
 */
export const listDailyActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { activeActionKey?: string | null } | undefined) =>
    z.object({ activeActionKey: z.string().min(1).nullable().optional() }).optional().parse(data),
  )
  .handler(async ({ data, context }): Promise<DailyAction[]> => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { currentDailyAction } = await import("@/server/crm/daily-actions-gate.server");
    return (await currentDailyAction(executiveId, { activeActionKey: data?.activeActionKey })).list;
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

/**
 * FILA OFICIAL LOGO APÓS UMA CONCLUSÃO — mesma autoridade da leitura
 * normal (`currentDailyAction` → `buildDailyActions`), devolvida junto
 * com o resultado para que a interface já mostre a PRÓXIMA AÇÃO CORRETA
 * (inclusive outra ação do MESMO investidor) sem esperar recarga.
 */
async function queueAfterOutcome(executiveId: string | null): Promise<DailyAction[]> {
  try {
    const { currentDailyAction } = await import("@/server/crm/daily-actions-gate.server");
    return (await currentDailyAction(executiveId)).list;
  } catch {
    return [];
  }
}

/** Dados mínimos de identificação da ação, vindos da própria lista. */
type ActionRefInput = {
  actionKey: string;
  leadId: string | null;
  kind: string;
  step: string | null;
  title: string;
  reason: string;
  /**
   * Resolução de uma pendência JÁ pulada, aberta pela Central de
   * Operações. Não altera a ordem do dia: apenas permite concluir a
   * mesma obrigação que ficou em aberto.
   */
  pendingRecovery?: boolean;
};

/**
 * PULAR COM JUSTIFICATIVA. A obrigação não desaparece do histórico:
 * fica registrada com autor, horário, investidor, etapa e motivo.
 *
 * A trava sequencial vale também para o Pular: só a ação corrente pode
 * ser pulada. Pular a ligação libera a MENSAGEM do mesmo investidor —
 * nunca o próximo investidor da fila.
 */
export const skipDailyActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ActionRefInput) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCurrentAction, releaseQueueClaim, queueItemIdOf } = await import(
      "@/server/crm/daily-actions-gate.server"
    );
    const current = await assertCurrentAction({
      executiveId,
      actionKey: data.actionKey,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    const { skipDailyAction } = await import("@/server/crm/daily-actions-log.server");
    await skipDailyAction({ ...data, userId: context.userId, executiveId });
    // Pular devolve a ação à fila (perde a reivindicação da posição 1).
    await releaseQueueClaim(queueItemIdOf(current));
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
 *
 * Caminho único do COPIAR: Biblioteca (versão ativa) → Central dos
 * Nomes → variante COM_NOME/SEM_NOME. Só a ação corrente pode ser
 * copiada — copiar fora da posição é rejeitado no servidor.
 */
export const getDailyActionMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      leadId: string;
      step: string;
      actionKey: string;
      context?: "SEM_CONTATO" | "CONTATO_REALIZADO";
      pendingRecovery?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCurrentLead } = await import("@/server/crm/daily-actions-gate.server");
    await assertCurrentLead({
      executiveId,
      leadId: data.leadId,
      activeActionKey: data.actionKey,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    if (data.context && data.context !== "CONTATO_REALIZADO") {
      throw new Error("Contexto de mensagem não permitido para esta ação.");
    }
    const { prepareStepMessage } = await import("@/server/relationship/step-message.server");
    return prepareStepMessage({
      leadId: data.leadId,
      step: data.step,
      context: data.context,
    });
  });

/**
 * PRÉ-GATILHO — AQUECIMENTO DO CAMINHO DE CONCLUSÃO (somente leitura).
 *
 * Chamado quando o Executivo escolhe o resultado da ligação, ANTES do
 * "Concluído". Não grava nada, não cria fila, não avança o motor e não
 * registra histórico: apenas deixa carregados os módulos que a conclusão
 * usaria em seguida, para que o "Concluído" não comece do zero.
 */
export const prewarmOutcomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context as never);
    await Promise.all([
      import("@/server/relationship/call-outcome.server"),
      import("@/server/relationship/engine.server"),
      import("@/server/relationship/step-message.server"),
      import("@/server/crm/daily-actions-gate.server"),
      import("@/server/crm/daily-actions.server"),
    ]).catch(() => undefined);
    return { ok: true as const };
  });

/** Registro de que a mensagem foi tratada pela interface (sem envio real). */
export const registerDailyActionMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ActionRefInput) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCurrentAction } = await import("@/server/crm/daily-actions-gate.server");
    await assertCurrentAction({
      executiveId,
      actionKey: data.actionKey,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    const { registerDailyActionMessage } = await import(
      "@/server/crm/daily-actions-log.server"
    );

    const outcome = await registerDailyActionMessage({
      ...data,
      userId: context.userId,
      executiveId,
    });
    return { ok: true as const, ...outcome, queue: await queueAfterOutcome(executiveId) };
  });

/** Conclusão única da etapa composta: ligação + mensagem no mesmo card. */
export const completeCallAndMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ActionRefInput & {
    queueItemId: string;
    callOutcome: "SIM" | "NAO";
    rang?: boolean | null;
  }) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCurrentAction } = await import("@/server/crm/daily-actions-gate.server");
    await assertCurrentAction({
      executiveId,
      actionKey: data.actionKey,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    const { completeCallAndMessage } = await import("@/server/crm/daily-actions-log.server");
    const outcome = await completeCallAndMessage({
      ...data,
      userId: context.userId,
      executiveId,
    });
    return { ok: true as const, ...outcome, queue: await queueAfterOutcome(executiveId) };
  });

/** Conclusão de apresentação/material manual na mesma fila oficial. */
export const completeDailyActionManualFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ActionRefInput) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCurrentAction } = await import("@/server/crm/daily-actions-gate.server");
    await assertCurrentAction({
      executiveId,
      actionKey: data.actionKey,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    const { completeDailyActionManual } = await import(
      "@/server/crm/daily-actions-log.server"
    );
    const outcome = await completeDailyActionManual({
      ...data,
      userId: context.userId,
      executiveId,
    });
    return { ok: true as const, ...outcome, queue: await queueAfterOutcome(executiveId) };
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
      pendingRecovery?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCommitmentAction } = await import("@/server/crm/daily-actions-gate.server");
    await assertCommitmentAction({
      executiveId,
      actionKey: data.actionKey,
      meetingId: data.meetingId,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    const { resolveMeetingOutcome } = await import("@/server/crm/daily-actions-log.server");
    await resolveMeetingOutcome({ ...data, userId: context.userId, executiveId });

    return { ok: true as const, queue: await queueAfterOutcome(executiveId) };
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
      pendingRecovery?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCommitmentAction } = await import("@/server/crm/daily-actions-gate.server");
    await assertCommitmentAction({
      executiveId,
      actionKey: data.actionKey,
      meetingId: data.meetingId,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    const { isGreenSalesMirror } = await import("@/server/crm/daily-actions-log.server");
    if (await isGreenSalesMirror(data.meetingId)) {
      throw new Error(
        "Compromisso do GreenSales: o reagendamento é feito no GreenSales e o Portal atualiza automaticamente.",
      );
    }
    const { rescheduleMeeting } = await import("@/server/crm/daily-actions-log.server");
    await rescheduleMeeting({ ...data, userId: context.userId, executiveId });
    return { ok: true as const, queue: await queueAfterOutcome(executiveId) };
  });

/**
 * FINANCEIRA /f — AGENDAMENTO ESPELHADO DO GREENSALES.
 * "Compareceu?" SIM/NÃO; nos dois casos, "Deseja novo agendamento?".
 * Nunca move o lead de estágio; nunca reagenda pelo Portal.
 */
export const resolveFollowUpContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      meetingId: string;
      attended: boolean;
      willReschedule: boolean;
      note?: string;
      actionKey: string;
      pendingRecovery?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCommitmentAction } = await import("@/server/crm/daily-actions-gate.server");
    await assertCommitmentAction({
      executiveId,
      actionKey: data.actionKey,
      meetingId: data.meetingId,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    const { registerFollowUpOutcome } = await import(
      "@/server/crm/greensales-followup.server"
    );
    const result = await registerFollowUpOutcome({
      meetingId: data.meetingId,
      attended: data.attended,
      willReschedule: data.willReschedule,
      actorId: executiveId,
      note: data.note ?? null,
    });
    if (!result.ok) throw new Error(result.reason ?? "Não foi possível registrar o desfecho.");
    return { ok: true as const, queue: await queueAfterOutcome(executiveId) };
  });

/**
 * HISTÓRICO COMPLEMENTAR DA AÇÃO DO DIA (ligação e primeiro contato).
 *
 * NÃO executa nada: a ligação e a E0 continuam sendo concluídas pelas
 * suas próprias funções oficiais. Aqui apenas o acontecimento vira uma
 * linha nas Notas do Executivo do MESMO investidor (`leadId`).
 */
export const recordDailyActionHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      actionKey: string;
      leadId: string | null;
      step: string | null;
      event: "ligacao" | "primeiro_contato" | "whatsapp";
      outcome?: string | null;
      note?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { historyHeadline, recordDailyActionHistory } = await import(
      "@/server/crm/daily-actions-history.server"
    );
    const nowIso = new Date().toISOString();
    const label =
      data.event === "primeiro_contato"
        ? "Primeiro contato registrado"
        : data.event === "whatsapp"
          ? "WhatsApp aberto pelo Executivo"
          : "Ligação realizada";
    await recordDailyActionHistory({
      leadId: data.leadId,
      sourceKey: `acao_do_dia:${data.actionKey}:${data.event}:${nowIso}`,
      headline: historyHeadline(label, data.step, nowIso),
      sections: [
        { label: "Resultado", value: data.outcome ?? null },
        { label: "Observação", value: data.note ?? null },
      ],
      executiveId,
      userId: context.userId,
    });
    return { ok: true as const };
  });

/**
 * DESFECHO DA LIGAÇÃO DA RÉGUA V2. A ligação é ação interna da etapa,
 * na própria fila do motor — nenhuma fila paralela é criada aqui.
 */
export const registerQueueCallOutcomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        queueItemId: z.string().uuid(),
        actionKey: z.string().min(1),
        outcome: z.enum(["SIM", "NAO"]),
        rang: z.union([z.number(), z.boolean()]).nullish(),
        pendingRecovery: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCurrentQueueItem } = await import("@/server/crm/daily-actions-gate.server");
    // O identificador do navegador só vale se for EXATAMENTE a ação corrente.
    const { current, queueItemId } = await assertCurrentQueueItem({
      executiveId,
      queueItemId: data.queueItemId,
      actionKey: data.actionKey,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    const { registerQueueCallOutcome } = await import(
      "@/server/relationship/call-outcome.server"
    );

    const result = await registerQueueCallOutcome({
      queueItemId,
      outcome: data.outcome,
      rang: data.rang ?? null,
      actorId: context.userId,
    });

    /**
     * RECUPERAÇÃO DE PENDÊNCIA — só tem efeito quando ESTA MESMA ação
     * foi pulada antes e ainda não havia sido recuperada. A própria
     * `recordSkipRecovery` verifica isso e não faz nada caso contrário.
     */
    if ((result as { concluded?: boolean })?.concluded) {
      const { recordSkipRecovery } = await import("@/server/crm/daily-actions-log.server");
      await recordSkipRecovery({
        actionKey: data.actionKey,
        leadId: current.leadId,
        kind: current.kind,
        step: current.stepLabel ?? null,
        title: current.title,
        userId: context.userId,
        executiveId,
        via: "ligacao",
        nowIso: new Date().toISOString(),
      });
    }
    /**
     * A fila oficial é recalculada AQUI, depois de gravado o desfecho:
     * se a régua liberou outra ação do MESMO investidor (por exemplo a
     * mensagem E0 após a 2ª ligação), ela já volta na posição 1.
     */
    return { ...(result as object), queue: await queueAfterOutcome(executiveId) };
  });

/**
 * DESFAZER O RESULTADO DA LIGAÇÃO (Atendeu / Não atendeu) — reversível
 * enquanto nenhuma ação posterior do investidor foi concluída. Nada é
 * apagado; fica registrado no histórico do lead.
 */
export const undoQueueCallOutcomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ queueItemId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { undoQueueCallOutcome } = await import("@/server/relationship/call-outcome.server");
    return undoQueueCallOutcome({ queueItemId: data.queueItemId, actorId: context.userId });
  });

/**
 * MATERIAL / APRESENTAÇÃO — registro estruturado do fato.
 *
 * O ramo E5 → E6 → E7 → E8 só nasce quando o material é efetivamente
 * pedido e disponibilizado. Nada é enviado aqui.
 */
export const registerMaterialEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leadId: z.string().min(1),
        type: z.enum(["MATERIAL_REQUESTED", "CONTENT_SENT"]),
        step: z.string().nullish(),
        note: z.string().max(500).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { registerMaterialEvent } = await import("@/server/relationship/material.server");
    return registerMaterialEvent({
      leadId: data.leadId,
      type: data.type,
      step: data.step ?? null,
      note: data.note ?? null,
      actorId: context.userId,
    });
  });

/**
 * ENCAMINHAMENTO DA LIGAÇÃO ATENDIDA.
 *
 * Quando o investidor atende, a régua PARA e aguarda decisão humana.
 * Esta é a saída estruturada dessa espera: o executivo declara o que
 * ficou combinado e a cadência volta a andar (ou permanece congelada,
 * no caso de agendamento).
 */
export const resolveHandoffFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leadId: z.string().min(1),
        decision: z.enum([
          "MATERIAL_SOLICITADO",
          "MATERIAL_ENVIADO",
          "AGENDAMENTO",
          "SEM_INTERESSE",
          "RETOMAR_CADENCIA",
        ]),
        note: z.string().max(500).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCurrentLead } = await import("@/server/crm/daily-actions-gate.server");
    await assertCurrentLead({ executiveId, leadId: data.leadId });
    const { resolveHandoff } = await import("@/server/relationship/handoff.server");
    return resolveHandoff({
      leadId: data.leadId,
      decision: data.decision,
      note: data.note ?? null,
      actorId: context.userId,
      executiveId,
    });
  });

/**
 * SÁBADO — ADIAR LEAD NOVO PARA O PRÓXIMO DIA ÚTIL.
 *
 * Só vale para a classe NOVO (primeiro contato) e só no sábado. Não
 * exige justificativa: é uma regra operacional, não um pulo.
 */
export const postponeNewLeadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ActionRefInput) => data)
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { assertCurrentAction } = await import("@/server/crm/daily-actions-gate.server");
    const current = await assertCurrentAction({
      executiveId,
      actionKey: data.actionKey,
      allowPendingRecovery: data.pendingRecovery === true,
    });
    if (current.source !== "first_contact") {
      throw new Error("Adiar para o próximo dia útil vale apenas para lead novo.");
    }
    const { postponeNewLeadToNextBusinessDay } = await import(
      "@/server/crm/daily-actions-log.server"
    );
    await postponeNewLeadToNextBusinessDay({
      ...data,
      userId: context.userId,
      executiveId,
    });
    return { ok: true as const };
  });


/**
 * PENDÊNCIAS PULADAS DO EXECUTIVO — somente leitura do histórico.
 * Não é uma segunda fila: apenas mostra o que foi pulado e ainda não
 * foi concluído, para que a MESMA ação possa ser retomada.
 */
export const listSkippedPendingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { listSkippedPendings } = await import("@/server/crm/daily-actions-log.server");
    return listSkippedPendings({ executiveId });
  });

/**
 * RESOLVER PENDÊNCIA — devolve a MESMA obrigação para a fila de hoje.
 * Nenhuma ação nova é criada e o pulo original permanece no histórico.
 */
export const resumeSkippedActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actionKey: string }) =>
    z.object({ actionKey: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { listSkippedPendings, resumeSkippedAction } = await import(
      "@/server/crm/daily-actions-log.server"
    );
    /** Só o dono da pendência pode retomá-la. */
    const pendings = await listSkippedPendings({ executiveId });
    const target = pendings.find((p) => p.actionKey === data.actionKey);
    if (!target) throw new Error("Pendência não encontrada para este Executivo.");
    await resumeSkippedAction({
      actionKey: target.actionKey,
      leadId: target.leadId,
      kind: target.kind,
      step: target.step,
      title: target.title,
      userId: context.userId,
      executiveId,
    });
    return { ok: true as const };
  });

/**
 * RESOLVER PENDÊNCIA DENTRO DA CENTRAL DE OPERAÇÕES.
 *
 * Devolve a MESMA obrigação já registrada (mesma `actionKey`) para que
 * o card operacional possa ser aberto sobre a Central. Não cria fila,
 * não cria obrigação e não altera a posição 1 da Ação do Dia: apenas
 * registra a retomada (quando ainda não registrada hoje) e lê a ação
 * oficial do servidor.
 */
export const resolvePendingActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actionKey: string }) =>
    z.object({ actionKey: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{
    status: "aberta" | "recuperada" | "indisponivel";
    action: DailyAction | null;
  }> => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { listSkippedPendings, resumeSkippedAction, hasSkipRecovery } = await import(
      "@/server/crm/daily-actions-log.server"
    );
    /** Só o dono da pendência pode resolvê-la. */
    const pendings = await listSkippedPendings({ executiveId });
    const target = pendings.find((p) => p.actionKey === data.actionKey);
    if (!target) {
      /**
       * A pendência saiu da lista de abertas: se a recuperação já está
       * registrada, isso NÃO é erro — é a confirmação de que ela foi
       * resolvida. A Central atualiza o estado sem F5.
       */
      if (await hasSkipRecovery(data.actionKey)) {
        return { status: "recuperada" as const, action: null };
      }
      throw new Error("Pendência não encontrada para este Executivo.");
    }

    if (!target.retomadaHoje) {
      await resumeSkippedAction({
        actionKey: target.actionKey,
        leadId: target.leadId,
        kind: target.kind,
        step: target.step,
        title: target.title,
        userId: context.userId,
        executiveId,
      });
    }

    const { buildDailyActions } = await import("@/server/crm/daily-actions.server");
    const { normalizeDailyActions } = await import("@/lib/crm/daily-actions");
    const list = normalizeDailyActions(await buildDailyActions({ executiveId }));
    const action = list.find((item) => item.actionKey === data.actionKey) ?? null;
    if (action) return { status: "aberta" as const, action };
    if (await hasSkipRecovery(data.actionKey)) {
      return { status: "recuperada" as const, action: null };
    }
    return { status: "indisponivel" as const, action: null };
  });

/**
 * CONFIRMAÇÃO DA RECUPERAÇÃO — leitura do histórico oficial. A Central
 * só considera a pendência resolvida depois desta confirmação.
 */
export const confirmPendingRecoveryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actionKey: string }) =>
    z.object({ actionKey: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { hasSkipRecovery } = await import("@/server/crm/daily-actions-log.server");
    return { recovered: await hasSkipRecovery(data.actionKey) };
  });

/**
 * ALERTA DE ATIVIDADE DO PORTAL — "Concluído" encerra SOMENTE o sinal.
 * Nenhuma obrigação é concluída, nenhuma cadência avança e nada é
 * enviado ao investidor.
 */
export const concludePortalAlertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actionKey: string; leadId: string | null }) =>
    z
      .object({ actionKey: z.string().min(1), leadId: z.string().nullable() })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{
    ok: true;
    leadId: string | null;
    viewedAt: string;
    queue: DailyAction[];
  }> => {
    await assertManager(context as never);
    const executiveId = await currentExecutiveId(context as never);
    const { concludePortalActivityAlert } = await import(
      "@/server/crm/portal-activity-alerts.server"
    );
    await concludePortalActivityAlert({
      actionKey: data.actionKey,
      leadId: data.leadId,
      userId: context.userId,
      executiveId,
    });
    return {
      ok: true,
      leadId: data.leadId,
      viewedAt: data.actionKey.slice(`portal_alert:${data.leadId}:`.length),
      queue: await queueAfterOutcome(executiveId),
    };
  });
