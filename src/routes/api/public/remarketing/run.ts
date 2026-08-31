/**
 * Gatilho externo do motor de Remarketing (agendador do banco).
 *
 * Rota pública por necessidade do agendador — a autorização é conferida
 * aqui dentro com a chave pública do projeto.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  automationUnauthorizedResponse,
  isAutomationRequestAuthorized,
} from "@/server/automation-auth.server";

export const Route = createFileRoute("/api/public/remarketing/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAutomationRequestAuthorized(request, "remarketing/run")) {
          return automationUnauthorizedResponse();
        }
        const { runRemarketingEngine } = await import("@/server/remarketing/engine.server");
        try {
          return Response.json(await runRemarketingEngine());
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro";
          console.error("[remarketing] execução automática falhou:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
