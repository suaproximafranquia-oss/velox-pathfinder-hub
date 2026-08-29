import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Link personalizado LEGADO (`/e/$slug`).
 *
 * Não abre módulo algum: sua única responsabilidade é informar o
 * contexto inicial da sessão (executivo responsável). O fluxo oficial
 * segue sempre Home da unidade → Gateway → Sessão → Manual → Portal.
 */
export const Route = createFileRoute("/e/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/f",
      replace: true,
      search: { e: params.slug, m: "manual", o: "Link personalizado" },
    });
  },
  component: () => null,
});
