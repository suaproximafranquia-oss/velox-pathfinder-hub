/**
 * Processador da fila da CENTRAL DOS NOMES.
 *
 * Acionado enquanto existe importação em andamento. Cada chamada digere
 * alguns blocos dentro de um orçamento de tempo e devolve o controle: se
 * a chamada for cortada, os blocos já concluídos permanecem e o ciclo
 * seguinte retoma exatamente do primeiro bloco pendente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { isAutomationRequestAuthorized } from "@/server/automation-auth.server";

export const Route = createFileRoute("/api/public/name-central/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAutomationRequestAuthorized(request, "name-central/process"))) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const { processNextNameImport } = await import(
          "@/server/relationship/name-central-import.server"
        );
        try {
          const result = await processNextNameImport();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro";
          console.error("[central-nomes] processamento da fila falhou:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
