import { createFileRoute } from "@tanstack/react-router";
import { InvestorPortalHome } from "@/components/portal/investor-portal-home";

/**
 * `/s/portal` — BASE VISUAL / DEMO do Portal do Investidor Velox Solar.
 *
 * Consome exatamente a mesma base do Portal do Investidor da Financeira.
 * Nesta etapa o conteúdo exibido (textos, imagens, módulos, overlays,
 * executivos e simulador) ainda é o da Financeira, propositalmente: a
 * personalização Solar acontece na etapa de equalização, quando existirem
 * Corporate Workspace e cadastros próprios da Solar.
 *
 * A página institucional `/s` e seu formulário permanecem intocados.
 */
type PortalSearch = {
  e?: string;
  m?: string;
  o?: string;
  u?: string;
  c?: string;
  b?: string;
  ch?: string;
  g?: string;
};

const str = (v: unknown) => {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

export const Route = createFileRoute("/s/portal")({
  validateSearch: (search: Record<string, unknown>): PortalSearch => ({
    e: str(search.e),
    m: str(search.m),
    o: str(search.o),
    u: str(search.u),
    c: str(search.c),
    b: str(search.b),
    ch: str(search.ch),
    g: str(search.g),
  }),
  head: () => ({
    meta: [
      { title: "Portal do Investidor — Velox Solar" },
      {
        name: "description",
        content:
          "Portal do Investidor da Velox Solar: versão base da experiência do investidor da unidade de energia solar do Grupo Velox.",
      },
      { property: "og:title", content: "Portal do Investidor — Velox Solar" },
      {
        property: "og:description",
        content: "Versão base do Portal do Investidor da Velox Solar, unidade do Grupo Velox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <InvestorPortalHome brandKey="solar" homePath="/s/portal" />,
});
