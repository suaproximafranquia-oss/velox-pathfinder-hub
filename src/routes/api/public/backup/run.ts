/**
 * Rotina automática da Central de Backup — REGISTRO DA HORA.
 *
 * Esta rota não executa mais a captura. Ela apenas registra a
 * solicitação da hora cheia, operação de milissegundos, imune ao
 * timeout de 5 segundos do agendador. O trabalho pesado é feito pelo
 * processador (`/api/public/backup/process`), acionado a cada minuto.
 *
 * Mantida por compatibilidade: qualquer agendamento antigo que ainda
 * chame esta URL continua alimentando a fila corretamente.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  automationUnauthorizedResponse,
  isAutomationRequestAuthorized,
} from "@/server/automation-auth.server";

async function authorized(request: Request): Promise<boolean> {
  return isAutomationRequestAuthorized(request, "backup/run");
}

export const Route = createFileRoute("/api/public/backup/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await authorized(request))) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { enqueueBackupRequest } = await import("@/server/backup-queue.server");
        try {
          const result = await enqueueBackupRequest();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro";
          console.error("[backup] registro da hora falhou:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
