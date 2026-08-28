import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota legada — a área operacional Financeira vive agora sob `/f`.
 * Redirecionamento controlado, preservando `search` e sem criar
 * histórico adicional.
 */
export const Route = createFileRoute("/executivo/templates")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/f/executivo/templates", replace: true, search: search as never });
  },
  component: () => null,
});
