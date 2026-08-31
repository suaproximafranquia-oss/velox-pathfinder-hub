/**
 * Gatilho externo da sincronização do CRM (agendador do banco).
 *
 * Rota pública por necessidade do agendador — por isso a autorização é
 * verificada aqui dentro, com a chave pública do projeto. O agendador
 * chama a cada minuto; o intervalo real é decidido no servidor.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  automationUnauthorizedResponse,
  isAutomationRequestAuthorized,
} from "@/server/automation-auth.server";

export const Route = createFileRoute("/api/public/crm/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAutomationRequestAuthorized(request, "crm/sync")) {
          return automationUnauthorizedResponse();
        }
        const { runScheduledLeadSync } = await import("@/server/crm/sync-scheduler.server");
        try {
          const result = await runScheduledLeadSync();
          return Response.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro";
          console.error("[crm-sync] rotina automática falhou:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
