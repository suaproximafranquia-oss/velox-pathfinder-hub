/**
 * Gatilho externo do motor de Remarketing (agendador do banco).
 *
 * Rota pública por necessidade do agendador — a autorização é conferida
 * aqui dentro com a chave pública do projeto.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/remarketing/run")({
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
