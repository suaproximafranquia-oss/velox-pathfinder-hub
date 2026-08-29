import { createFileRoute, redirect } from "@tanstack/react-router";
import { getBrandByPrefix } from "@/lib/portal-brands";

/**
 * Link público do Portal do Investidor — MARCA + EXECUTIVO.
 * Prefixo "f". Não abre módulo: apenas define o contexto de entrada
 * (marca e executivo responsável) e devolve o visitante à home da
 * unidade (`/f`), preservando exatamente os mesmos parâmetros de
 * contexto de sempre (`e`, `m`, `o`, `b`).
 */
export const Route = createFileRoute("/f/$slug")({
  beforeLoad: ({ params }) => {
    const brand = getBrandByPrefix("f")!;
    throw redirect({
      to: "/f",
      replace: true,
      search: { e: params.slug, m: "manual", o: brand.origin, b: brand.key },
    });
  },
  component: () => null,
});
