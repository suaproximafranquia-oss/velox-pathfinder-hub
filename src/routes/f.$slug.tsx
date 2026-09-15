import { createFileRoute, redirect } from "@tanstack/react-router";
import { getBrandByPrefix } from "@/lib/portal-brands";
import { resolveExecutivePortalAlias } from "@/lib/executive-portal-link.functions";

/**
 * Link público do Portal do Investidor — MARCA + EXECUTIVO.
 * Prefixo "f". Não abre módulo: apenas define o contexto de entrada
 * (marca e executivo responsável) e devolve o visitante à home da
 * unidade (`/f`), preservando exatamente os mesmos parâmetros de
 * contexto de sempre (`e`, `m`, `o`, `b`).
 */
export const Route = createFileRoute("/f/$slug")({
  beforeLoad: async ({ params }) => {
    const brand = getBrandByPrefix("f");
    const executive = await resolveExecutivePortalAlias({ data: { slug: params.slug } });
    if (!brand || !executive) {
      throw redirect({ to: "/f", replace: true, search: {} });
    }
    throw redirect({
      to: "/f",
      replace: true,
      search: { e: executive.slug, m: "manual", o: brand.origin, b: brand.key },
    });
  },
  component: () => null,
});
