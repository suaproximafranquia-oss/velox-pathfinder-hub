/**
 * Rota legada — o acesso oficial passou a ser o "Portal dos Leads",
 * aberto em aba própria. Mantida apenas para preservar links antigos.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/executivo/greensales")({
  beforeLoad: () => {
    throw redirect({ to: "/portal-leads" });
  },
});
