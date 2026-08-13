import { createFileRoute, redirect } from "@tanstack/react-router";
import { getBrandByPrefix } from "@/lib/portal-brands";

/**
 * Link público do Portal do Investidor — MARCA + EXECUTIVO.
 * Prefixo "seg". Não abre módulo: apenas define o contexto de entrada
 * (marca e executivo responsável) e devolve o visitante à Home.
 */
export const Route = createFileRoute("/seg/$slug")({
  beforeLoad: ({ params }) => {
    const brand = getBrandByPrefix("seg")!;
    throw redirect({
      to: "/",
      replace: true,
      search: { e: params.slug, m: "manual", o: brand.origin, b: brand.key },
    });
  },
  component: () => null,
});
