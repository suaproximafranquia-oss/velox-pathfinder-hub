import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Link personalizado (`/e/$slug`).
 *
 * Não abre módulo algum: sua única responsabilidade é informar o
 * contexto inicial da sessão (executivo responsável). O fluxo oficial
 * segue sempre Home → Gateway → Sessão → Manual → Portal.
 */
export const Route = createFileRoute("/e/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/",
      replace: true,
      search: { e: params.slug, m: "manual", o: "Link personalizado" },
    });
  },
  component: () => null,
});
