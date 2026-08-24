/**
 * Rotina automática da Central de Backup.
 *
 * Chamada pelo servidor em intervalos regulares (1 hora — COMANDO 3A
 * §15), sem depender de qualquer usuário logado. Cria um ponto de
 * restauração do estado do banco e aplica a política de retenção — que
 * remove apenas pontos automáticos antigos, nunca dados do Portal.
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

export const Route = createFileRoute("/api/public/backup/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { createBackup, pruneBackups } = await import("@/server/backup.server");
        try {
          const record = await createBackup({ kind: "completo", origin: "automatico" });
          const pruned = await pruneBackups();
          return Response.json({ ok: true, id: record.id, size: record.sizeBytes, pruned });
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro";
          console.error("[backup] rotina automática falhou:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});