import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota legada — a área operacional Financeira vive agora sob `/f`.
 * Redirecionamento controlado, preservando `search` e sem criar
 * histórico adicional.
 */
export const Route = createFileRoute("/executivo/captacao")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/f/executivo/captacao", replace: true, search: search as never });
  },
  component: () => null,
});
