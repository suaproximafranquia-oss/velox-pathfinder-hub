/**
 * Processador da fila de backup.
 *
 * Acionado a cada minuto. Sem solicitação pendente, custa uma leitura e
 * responde imediatamente. Havendo solicitação, toma um lease e executa a
 * captura — e a solicitação só é dada como concluída depois de o ponto
 * de restauração estar gravado e validado.
 *
 * Se o agendador cortar a chamada em 5 segundos, nada se perde: a
 * solicitação permanece na fila e é retomada no ciclo seguinte.
 */
import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const expected =
    process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer /i, "") ??
    "";
  return Boolean(expected) && provided === expected;
}

export const Route = createFileRoute("/api/public/backup/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { processNextBackupRequest } = await import("@/server/backup-queue.server");
        try {
          const result = await processNextBackupRequest();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro";
          console.error("[backup] processamento da fila falhou:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
