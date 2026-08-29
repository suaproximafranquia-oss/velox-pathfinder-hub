import { createFileRoute, redirect } from "@tanstack/react-router";
import { getBrandByPrefix } from "@/lib/portal-brands";

/**
 * Link público do Portal do Investidor — MARCA + EXECUTIVO.
 * Prefixo "s". Não abre módulo: apenas define o contexto de entrada
 * (marca e executivo responsável) e devolve o visitante à Home.
 */
export const Route = createFileRoute("/s/$slug")({
  beforeLoad: ({ params }) => {
    const brand = getBrandByPrefix("s")!;
    throw redirect({
      to: "/s",
      replace: true,
      search: { e: params.slug, m: "manual", o: brand.origin, b: brand.key },
    });
  },
  component: () => null,
});
