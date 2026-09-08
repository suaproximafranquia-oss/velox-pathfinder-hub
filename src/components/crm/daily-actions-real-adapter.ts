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
  registerQueueCallOutcomeFn,
  rescheduleMeetingFn,
  resolveMeetingOutcomeFn,
  resolveFollowUpContactFn,
  resolveFollowUpReviewFn,
  skipDailyActionFn,
} from "@/lib/crm/daily-actions.functions";
import { executeFirstContactAction } from "@/lib/crm/first-contact-mode.functions";
import type { DailyAction } from "@/lib/crm/daily-actions";
import type { DailyActionsAdapter } from "@/lib/crm/daily-actions.adapter";

/** Identificação mínima da ação enviada ao histórico oficial. */
function actionRef(item: DailyAction, reason: string) {
  return {
    actionKey: item.actionKey,
    leadId: item.leadId,
    kind: item.kind,
    step: item.stepLabel,
    title: item.title,
    reason,
  };
}

export function useRealDailyActionsAdapter(): DailyActionsAdapter {
  const fetchActions = useServerFn(listDailyActions);
  const completeTask = useServerFn(completeCadenceTaskFn);
  const registerWhatsapp = useServerFn(registerWhatsappCallAttemptFn);
  const executeFirstContact = useServerFn(executeFirstContactAction);
  const skipAction = useServerFn(skipDailyActionFn);
  const noteAction = useServerFn(noteDailyActionFn);
  const loadStepMessage = useServerFn(getDailyActionMessageFn);
  const registerMessage = useServerFn(registerDailyActionMessageFn);
  const registerQueueCall = useServerFn(registerQueueCallOutcomeFn);
  const recordHistory = useServerFn(recordDailyActionHistoryFn);
  const resolveMeeting = useServerFn(resolveMeetingOutcomeFn);
  const rescheduleMeeting = useServerFn(rescheduleMeetingFn);
  const resolveFollowUpContact = useServerFn(resolveFollowUpContactFn);
  const resolveFollowUpReview = useServerFn(resolveFollowUpReviewFn);

  return useMemo<DailyActionsAdapter>(
    () => ({
      load: () => fetchActions(),
      executeFirstContact: async (item) => {
        if (!item.firstContactActionId) return { ok: false };
        const result = await executeFirstContact({
          data: { actionId: item.firstContactActionId },
        });
        if (result.ok) {
          // Histórico complementar: nunca bloqueia a execução da E0.
          try {
            await recordHistory({
              data: {
                actionKey: item.actionKey,
                leadId: item.leadId,
                step: item.stepLabel,
                event: "primeiro_contato",
              },
            });
          } catch {
            /* histórico é complementar */
          }
        }
        return result.ok
          ? { ok: true, message: "Primeiro contato registrado." }
          : { ok: false, message: result.reason ?? undefined };
      },
      completeCall: async (item, outcome, rang) => {
        /**
         * LIGAÇÃO DA RÉGUA V2 — a ação interna vive na fila do motor.
         * Atendeu ⇒ as ações restantes da etapa são canceladas e o ciclo
         * aguarda o encaminhamento; não atendeu ⇒ a régua segue.
         */
        if (!item.cadence && item.actionKey.startsWith("queue:")) {
          const queueItemId = item.actionKey.split(":").pop() ?? "";
          if (!queueItemId) return { ok: false };
          const result = (await registerQueueCall({
            data: {
              queueItemId,
              actionKey: item.actionKey,
              outcome,
              rang: outcome === "NAO" ? (rang ?? null) : null,
            },
          })) as { awaitingHandoff?: boolean };

          try {
            await recordHistory({
              data: {
                actionKey: item.actionKey,
                leadId: item.leadId,
                step: item.stepLabel,
                event: "ligacao",
                outcome: outcome === "SIM" ? "Atendeu" : "Não atendeu",
              },
            });
          } catch {
            /* histórico é complementar */
          }
          return {
            ok: true,
            message: result?.awaitingHandoff
              ? "Ligação atendida — a cadência aguarda o encaminhamento."
              : "Tentativa registrada.",
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
        try {
          await recordHistory({
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
          });
        } catch {
          /* histórico é complementar */
        }
        return { ok: true, message: "Tentativa registrada." };
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
        await skipAction({ data: actionRef(item, reason) });
        return { ok: true, message: "Ação pulada e registrada no histórico." };
      },
      addNote: async (item, note) => {
        await noteAction({ data: actionRef(item, note) });
        return { ok: true, message: "Observação registrada." };
      },
      loadMessage: async (item) => {
        const step = item.messageRef?.step ?? item.stepLabel;
        if (!item.leadId || !step) return null;
        return loadStepMessage({
          data: { leadId: item.leadId, step, leadName: item.name },
        });
      },
      registerMessage: async (item, note) => {
        const result = (await registerMessage({ data: actionRef(item, note) })) as {
          concluded?: boolean;
        };
        return {
          ok: true,
          message: result?.concluded
            ? "Etapa concluída — o motor segue para a próxima."
            : "Mensagem registrada no histórico.",
        };
      },
      resolveMeeting: async (item, attended, note) => {
        if (!item.meetingId) return { ok: false, message: "Reunião sem origem oficial." };
        await resolveMeeting({
          data: {
            meetingId: item.meetingId,
            attended,
            note,
            leadId: item.leadId,
            actionKey: item.actionKey,
            title: item.title,
          },
        });
        return {
          ok: true,
          message: attended ? "Reunião concluída." : "Não comparecimento registrado.",
        };
      },
      rescheduleMeeting: async (item, scheduledAt, note) => {
        if (!item.meetingId) return { ok: false, message: "Reunião sem origem oficial." };
        await rescheduleMeeting({
          data: {
            meetingId: item.meetingId,
            scheduledAt,
            note,
            leadId: item.leadId,
            actionKey: item.actionKey,
            title: item.title,
          },
        });
        return { ok: true, message: "Reunião reagendada." };
      },
      resolveFollowUpContact: async (item, decision) => {
        if (!item.meetingId) return { ok: false, message: "Agendamento sem origem oficial." };
        try {
          await resolveFollowUpContact({
            data: {
              meetingId: item.meetingId,
              contacted: decision.contacted,
              willReschedule: decision.willReschedule,
              note: decision.note,
              actionKey: item.actionKey,
            },
          });
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "Falha ao registrar." };
        }
        return {
          ok: true,
          message: decision.contacted
            ? "Contato de agendamento registrado."
            : decision.willReschedule
              ? "Faça o novo agendamento no GreenSales — o Portal atualiza automaticamente."
              : "Registrado sem contato. Amanhã a Ação do Dia pedirá a decisão de encerrar ou retomar.",
        };
      },
      resolveFollowUpReview: async (item, decision) => {
        if (!item.meetingId) return { ok: false, message: "Agendamento sem origem oficial." };
        try {
          await resolveFollowUpReview({
            data: {
              meetingId: item.meetingId,
              close: decision.close,
              note: decision.note,
              actionKey: item.actionKey,
            },
          });
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "Falha ao registrar." };
        }
        return {
          ok: true,
          message: decision.close
            ? "Fluxo de agendamento encerrado."
            : "Então retire esse lead de Agendamento e mova para Frios no GreenSales para retomarmos o relacionamento.",
        };
      },
    }),
    [
      fetchActions,
      completeTask,
      registerWhatsapp,
      executeFirstContact,
      skipAction,
      noteAction,
      loadStepMessage,
      registerMessage,
      registerQueueCall,
      recordHistory,
      resolveMeeting,
      rescheduleMeeting,
      resolveFollowUpContact,
      resolveFollowUpReview,
    ],
  );
}
