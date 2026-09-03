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
import { listDailyActions } from "@/lib/crm/daily-actions.functions";
import { executeFirstContactAction } from "@/lib/crm/first-contact-mode.functions";
import type { DailyActionsAdapter } from "@/lib/crm/daily-actions.adapter";

export function useRealDailyActionsAdapter(): DailyActionsAdapter {
  const fetchActions = useServerFn(listDailyActions);
  const completeTask = useServerFn(completeCadenceTaskFn);
  const registerWhatsapp = useServerFn(registerWhatsappCallAttemptFn);
  const executeFirstContact = useServerFn(executeFirstContactAction);

  return useMemo<DailyActionsAdapter>(
    () => ({
      load: () => fetchActions(),
      executeFirstContact: async (item) => {
        if (!item.firstContactActionId) return { ok: false };
        const result = await executeFirstContact({
          data: { actionId: item.firstContactActionId },
        });
        return result.ok
          ? { ok: true, message: "Primeiro contato registrado." }
          : { ok: false, message: result.reason ?? undefined };
      },
      completeCall: async (item, outcome) => {
        if (!item.cadence) return { ok: false };
        await completeTask({
          data: {
            leadId: item.cadence.crmLeadId,
            step: item.cadence.step,
            dueDate: item.cadence.dueDate,
            cycleDate: item.cadence.cycleDate,
            channel: "call",
            outcome,
          },
        });
        return { ok: true };
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
    }),
    [fetchActions, completeTask, registerWhatsapp, executeFirstContact],
  );
}
