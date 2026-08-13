/**
 * Gatilho externo da sincronização do CRM (agendador do banco).
 *
 * Rota pública por necessidade do agendador — por isso a autorização é
 * verificada aqui dentro, com a chave pública do projeto.
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
        const { runLeadSync } = await import("@/server/crm/lead-sync.server");
        const summary = await runLeadSync("cron");
        return Response.json(summary);
      },
    },
  },
});
