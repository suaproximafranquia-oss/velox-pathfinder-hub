import { createFileRoute, redirect } from "@tanstack/react-router";
import { getExecutiveBySlug } from "@/lib/executive-auth";
import { setResponsibleExecutiveSlug } from "@/lib/responsible-executive";

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
    if (typeof window !== "undefined") {
      const exec = getExecutiveBySlug(params.slug);
      if (exec) setResponsibleExecutiveSlug(exec.slug);
    }
    throw redirect({ to: "/" });
  },
  component: () => null,
});