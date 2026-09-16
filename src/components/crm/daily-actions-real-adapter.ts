/**
 * ADAPTADOR REAL DA AÇÃO DO DIA.
 *
 * Liga o painel às MESMAS funções oficiais já usadas hoje. Nenhuma
 * regra de negócio muda aqui: apenas o ponto de ligação saiu de dentro
 * do componente para que a fonte de dados possa ser escolhida por quem
 * o renderiza.
 */
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeCadenceTaskFn, registerWhatsappCallAttemptFn } from "@/lib/crm/cadence.functions";
import {
  getDailyActionMessageFn,
  listDailyActions,
  noteDailyActionFn,
  recordDailyActionHistoryFn,
  registerDailyActionMessageFn,
  completeDailyActionManualFn,
  completeCallAndMessageFn,
  registerQueueCallOutcomeFn,
  prewarmOutcomeFn,
  undoQueueCallOutcomeFn,
  rescheduleMeetingFn,
  resolveMeetingOutcomeFn,
  resolveFollowUpContactFn,
  skipDailyActionFn,
  listSkippedPendingsFn,
  resumeSkippedActionFn,
  concludePortalAlertFn,
} from "@/lib/crm/daily-actions.functions";
import type { DailyAction } from "@/lib/crm/daily-actions";
import type { DailyActionsAdapter } from "@/lib/crm/daily-actions.adapter";
import { loadLeads, patchCachedLead } from "@/lib/leads";
import { notifySync } from "@/lib/sync-bus";
import { emitEvent } from "@/lib/events/bus";

/** Identificação mínima da ação enviada ao histórico oficial. */
function actionRef(item: DailyAction, reason: string, pendingRecovery = false) {
  return {
    actionKey: item.actionKey,
    leadId: item.leadId,
    kind: item.kind,
    step: item.stepLabel,
    title: item.title,
    reason,
    pendingRecovery,
  };
}

/**
 * `pendingRecovery` só é usado pela Central de Operações, ao resolver
 * uma pendência JÁ pulada pelo próprio Executivo. Ele não cria fila nem
 * obrigação: apenas informa ao servidor que a ação autorizada é aquela
 * mesma pendência em aberto, e não a posição 1 do dia.
 */
export function useRealDailyActionsAdapter(
  options: { pendingRecovery?: boolean } = {},
): DailyActionsAdapter {
  const pendingRecovery = options.pendingRecovery === true;
  const fetchActions = useServerFn(listDailyActions);
  const completeTask = useServerFn(completeCadenceTaskFn);
  const registerWhatsapp = useServerFn(registerWhatsappCallAttemptFn);
  const skipAction = useServerFn(skipDailyActionFn);
  const noteAction = useServerFn(noteDailyActionFn);
  const loadStepMessage = useServerFn(getDailyActionMessageFn);
  const registerMessage = useServerFn(registerDailyActionMessageFn);
  const completeManual = useServerFn(completeDailyActionManualFn);
  const completeCallAndMessage = useServerFn(completeCallAndMessageFn);
  const registerQueueCall = useServerFn(registerQueueCallOutcomeFn);
  const prewarmOutcome = useServerFn(prewarmOutcomeFn);
  const undoQueueCall = useServerFn(undoQueueCallOutcomeFn);
  const recordHistory = useServerFn(recordDailyActionHistoryFn);
  const resolveMeeting = useServerFn(resolveMeetingOutcomeFn);
  const rescheduleMeeting = useServerFn(rescheduleMeetingFn);
  const resolveFollowUpContact = useServerFn(resolveFollowUpContactFn);
  const listPendingsFn = useServerFn(listSkippedPendingsFn);
  const resumePendingFn = useServerFn(resumeSkippedActionFn);
  const concludeAlertFn = useServerFn(concludePortalAlertFn);

  return useMemo<DailyActionsAdapter>(
    () => ({
      load: (activeActionKey) => fetchActions({ data: { activeActionKey: activeActionKey ?? null } }),
      /**
       * PRIMEIRO CONTATO LEGADO — DESATIVADO. A E0 é etapa da régua V2
       * (ligação única → mensagem para copiar). Nenhum
       * caminho desta tela envia a mensagem E0.
       */
      executeFirstContact: async () => ({
        ok: false,
        message:
          "A E0 é executada pela régua: ligação e depois a mensagem para copiar.",
      }),

      completeCall: async (item, outcome, rang) => {
        /**
         * LIGAÇÃO DA RÉGUA V2 — a ação interna vive na fila do motor.
         * Qualquer resultado libera a mensagem correta da mesma etapa.
         * Nenhuma mensagem é enviada por aqui.
         */
        if (!item.cadence && item.actionKey.startsWith("queue:")) {
          const queueItemId = item.queueItemId ?? item.actionKey.split(":").pop() ?? "";
          if (!queueItemId) return { ok: false };
          let result: { concluded?: boolean; awaitingHandoff?: boolean; queue?: DailyAction[] };
          try {
            result = (await registerQueueCall({
              data: {
                queueItemId,
                actionKey: item.actionKey,
                outcome,
                rang: outcome === "NAO" ? (rang ?? null) : null,
                pendingRecovery,
              },
            })) as { concluded?: boolean; awaitingHandoff?: boolean; queue?: DailyAction[] };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Falha ao registrar." };
          }
          if (!result?.concluded) {
            return { ok: false, message: "Esta ligação já foi resolvida — a lista foi atualizada." };
          }

          /**
           * HISTÓRICO EM SEGUNDO PLANO: a troca do card não espera por
           * ele. A conclusão em si já foi confirmada pelo servidor.
           */
          void recordHistory({
            data: {
              actionKey: item.actionKey,
              leadId: item.leadId,
              step: item.stepLabel,
              event: "ligacao",
              outcome: outcome === "SIM" ? "Atendeu" : "Não atendeu",
            },
          }).catch(() => undefined);

          return {
            ok: true,
            /** Fila oficial já recalculada pelo servidor. */
            queue: result?.queue,
          };

        }
        if (!item.cadence) return { ok: false };
        await completeTask({
          data: {
            leadId: item.cadence.crmLeadId,
            step: item.cadence.step,
            dueDate: item.cadence.dueDate,
            cycleDate: item.cadence.cycleDate,
            channel: "call",
            outcome,
            rang: outcome === "NAO" ? (rang ?? null) : null,
          },
        });
        void recordHistory({
          data: {
            actionKey: item.actionKey,
            leadId: item.leadId,
            step: item.stepLabel ?? String(item.cadence.step),
            event: "ligacao",
            outcome: outcome === "SIM"
                ? "Atendeu"
                : rang
                  ? `Chamou ${rang}x e não atendeu`
                  : "Não atendeu",
          },
        }).catch(() => undefined);
        return { ok: true, message: "Tentativa registrada." };
      },
      completeCallAndMessage: async (item, outcome, rang, note) => {
        const queueItemId = item.queueItemId ?? item.actionKey.split(":").pop() ?? "";
        if (!queueItemId) return { ok: false, message: "Ligação sem origem oficial." };
        const result = await completeCallAndMessage({
          data: {
            ...actionRef(item, note, pendingRecovery),
            queueItemId,
            callOutcome: outcome,
            rang: outcome === "NAO" ? (rang ?? null) : null,
          },
        });
        return {
          ok: Boolean(result?.concluded),
          queue: result?.queue,
          message: result?.concluded
            ? "Etapa concluída — ligação e mensagem registradas."
            : result?.reason ?? "Não foi possível concluir a etapa.",
        };
      },
      undoCallOutcome: async (item) => {
        const queueItemId = item.queueItemId ?? item.actionKey.split(":").pop() ?? "";
        if (!queueItemId || !item.actionKey.startsWith("queue:")) return { ok: false };
        try {
          const result = (await undoQueueCall({ data: { queueItemId } })) as {
            undone?: boolean;
            reason?: string | null;
          };
          return result?.undone
            ? { ok: true, message: "Resultado da ligação desfeito — a ação voltou para a fila." }
            : { ok: false, message: result?.reason ?? "Não foi possível desfazer." };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "Falha ao desfazer." };
        }
      },
      openWhatsapp: async (item) => {
        const digits = item.phone.replace(/\D/g, "");
        if (!digits) return { ok: false };
        window.open(`https://wa.me/${digits}`, "_blank", "noopener");
        if (item.cadence) {
          try {
            await registerWhatsapp({
              data: {
                leadId: item.cadence.crmLeadId,
                step: item.cadence.step,
                cycleDate: item.cadence.cycleDate,
              },
            });
          } catch {
            /* o registro de histórico nunca bloqueia a operação */
          }
        }
        return { ok: true };
      },
      skip: async (item, reason) => {
        await skipAction({ data: actionRef(item, reason, pendingRecovery) });
        return { ok: true, message: "Ação pulada e registrada no histórico." };
      },
      addNote: async (item, note) => {
        await noteAction({ data: actionRef(item, note, pendingRecovery) });
        return { ok: true, message: "Observação registrada." };
      },
      /**
       * PRÉ-GATILHO — apenas aquece o caminho oficial no servidor. Nada
       * é gravado, criado ou concluído aqui.
       */
      prewarmOutcome: () => {
        void prewarmOutcome({}).catch(() => undefined);
      },
      loadMessage: async (item, context) => {
        const step = item.messageRef?.step ?? item.stepLabel;
        if (!item.leadId || !step) return null;
        return loadStepMessage({
          data: { leadId: item.leadId, step, actionKey: item.actionKey, context, pendingRecovery },
        });
      },
      registerMessage: async (item, note) => {
        const result = (await registerMessage({ data: actionRef(item, note, pendingRecovery) })) as {
          concluded?: boolean;
          queue?: DailyAction[];
        };
        return {
          ok: true,
          queue: result?.queue,
          message: result?.concluded
            ? "Etapa concluída — o motor segue para a próxima."
            : "Mensagem registrada no histórico.",
        };
      },
      completeManual: async (item, note) => {
        const result = (await completeManual({ data: actionRef(item, note, pendingRecovery) })) as {
          concluded?: boolean;
          queue?: DailyAction[];
        };
        return {
          ok: true,
          queue: result?.queue,
          message: result?.concluded
            ? "Ação manual concluída — o motor segue para a próxima etapa."
            : "Ação manual já estava resolvida.",
        };
      },
      resolveMeeting: async (item, attended, note) => {
        if (!item.meetingId) return { ok: false, message: "Reunião sem origem oficial." };
        const result = (await resolveMeeting({
          data: {
            meetingId: item.meetingId,
            attended,
            note,
            leadId: item.leadId,
            actionKey: item.actionKey,
            title: item.title,
            pendingRecovery,
          },
        })) as { queue?: DailyAction[] };
        return {
          ok: true,
          queue: result?.queue,
          message: attended ? "Reunião concluída." : "Não comparecimento registrado.",
        };
      },
      rescheduleMeeting: async (item, scheduledAt, note) => {
        if (!item.meetingId) return { ok: false, message: "Reunião sem origem oficial." };
        const result = (await rescheduleMeeting({
          data: {
            meetingId: item.meetingId,
            scheduledAt,
            note,
            leadId: item.leadId,
            actionKey: item.actionKey,
            title: item.title,
            pendingRecovery,
          },
        })) as { queue?: DailyAction[] };
        return { ok: true, queue: result?.queue, message: "Reunião reagendada." };
      },
      resolveFollowUpContact: async (item, decision) => {
        if (!item.meetingId) return { ok: false, message: "Agendamento sem origem oficial." };
        let result: { queue?: DailyAction[] };
        try {
          result = (await resolveFollowUpContact({
            data: {
              meetingId: item.meetingId,
              attended: decision.attended,
              willReschedule: decision.willReschedule,
              note: decision.note,
              actionKey: item.actionKey,
              pendingRecovery,
            },
          })) as { queue?: DailyAction[] };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "Falha ao registrar." };
        }
        return {
          ok: true,
          queue: result?.queue,
          message: decision.willReschedule
              ? "Faça o novo agendamento no GreenSales — o Portal atualiza automaticamente."
              : "Desfecho registrado e compromisso concluído.",
        };
      },

      /** Pendências puladas do próprio Executivo — decidido no servidor. */
      listPendings: async () => (await listPendingsFn()) as never,
      resumePending: async (actionKey) => {
        try {
          await resumePendingFn({ data: { actionKey } });
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : "Falha ao retomar a pendência.",
          };
        }
        return { ok: true, message: "Pendência devolvida à fila de hoje." };
      },

      /**
       * ALERTA DE ATIVIDADE DO PORTAL — "Concluído" encerra apenas o
       * sinal. Nenhuma obrigação, cadência ou envio é afetado.
       */
      concludeAlert: async (item) => {
        try {
          const result = (await concludeAlertFn({
            data: { actionKey: item.actionKey, leadId: item.leadId },
          })) as { queue?: DailyAction[]; viewedAt?: string; leadId?: string | null };
          if (result.viewedAt && result.leadId) {
            const previousViewedAt = loadLeads().find((lead) => lead.id === result.leadId)?.viewedAt ?? null;
            patchCachedLead(result.leadId, { viewedAt: result.viewedAt });
            if (!previousViewedAt || result.viewedAt > previousViewedAt) {
              emitEvent({
                type: "lead.status.changed",
                investorId: result.leadId,
                at: result.viewedAt,
                dedupeKey: `lead.status.changed:${result.leadId}:${result.viewedAt}`,
              });
            }
            notifySync("status");
          }
          return {
            ok: true,
            message: "Alerta concluído.",
            ...(result?.queue ? { queue: result.queue } : {}),
          };
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : "Falha ao concluir o alerta.",
          };
        }
      },
    }),
    [
      pendingRecovery,
      fetchActions,
      listPendingsFn,
      resumePendingFn,
      concludeAlertFn,
      completeTask,
      completeCallAndMessage,
      registerWhatsapp,
      skipAction,
      noteAction,
      loadStepMessage,
      registerMessage,
      registerQueueCall,
      prewarmOutcome,
      recordHistory,
      resolveMeeting,
      rescheduleMeeting,
      resolveFollowUpContact,
    ],
  );
}
