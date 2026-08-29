import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Entrada por campanhas patrocinadas. Define apenas o contexto de
 * origem — a navegação segue o fluxo oficial pela Home.
 */
export const Route = createFileRoute("/manual/anuncio")({
  beforeLoad: () => {
    throw redirect({
      to: "/f",
      replace: true,
      search: { m: "manual", o: "anuncio", c: "anuncio" },
    });
  },
  component: () => null,
});
