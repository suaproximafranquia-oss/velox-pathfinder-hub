/**
 * Gatilho externo da sincronização do CRM (agendador do banco).
 *
 * Rota pública por necessidade do agendador — por isso a autorização é
 * verificada aqui dentro, com a chave pública do projeto. O agendador
 * chama a cada minuto; o intervalo real é decidido no servidor.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/crm/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const accepted = [
          process.env["SUPABASE_ANON_KEY"],
          process.env["SUPABASE_PUBLISHABLE_KEY"],
        ].filter((v): v is string => Boolean(v));
        if (!accepted.length || !accepted.includes(key)) {
          return new Response("Não autorizado", { status: 401 });
        }
        const { runScheduledLeadSync } = await import("@/server/crm/sync-scheduler.server");
        /**
         * O mesmo gatilho de minuto executa as entradas programadas do
         * teste de 24 horas. É trabalho limitado (no máximo 5 eventos
         * por passagem) e nunca interrompe a sincronização real.
         */
        let batch24h: unknown = null;
        try {
          const { runBatch24hTick } = await import("@/server/testing/batch24h.server");
          batch24h = await runBatch24hTick();
        } catch (error) {
          console.error(
            "[teste-24h] worker não executou:",
            error instanceof Error ? error.message : error,
          );
        }
        try {
          const result = await runScheduledLeadSync();
          return Response.json({ ...result, batch24h });
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro";
          console.error("[crm-sync] rotina automática falhou:", message);
          return Response.json({ ok: false, error: message, batch24h }, { status: 500 });
        }
      },
    },
  },
});
