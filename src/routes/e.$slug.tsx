import { createFileRoute, redirect } from "@tanstack/react-router";
import { getExecutiveBySlug } from "@/lib/executive-auth";

/**
 * Rota de entrada personalizada do Manual (`/e/$slug`).
 * Persiste o executivo responsável e leva o visitante ao Capítulo 1.
 * A propriedade é permanente durante a jornada — nunca é sobrescrita
 * pelo Executivo Padrão do workspace.
 */
export const Route = createFileRoute("/e/$slug")({
  head: () => ({
    meta: [
      { title: "Manual do Investidor Velox" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: ({ params }) => {
    const exec = getExecutiveBySlug(params.slug);
    throw redirect({
      to: "/entrar",
      search: { next: "/manual", executive: exec?.slug ?? params.slug },
    });
  },
  component: () => null,
});