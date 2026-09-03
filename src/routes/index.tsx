/**
 * PORTAL INSTITUCIONAL DO GRUPO VELOX — raiz pública.
 *
 * A raiz NÃO é operacional: não tem Gateway, simulador, captação,
 * cadência ou Portal do Investidor. Ela apresenta as três empresas do
 * Grupo:
 *
 *   Velox Soluções Financeiras → leva ao ambiente /f (jornada oficial)
 *   Velox Solar                → formulário de interesse (vira card)
 *   Velox Seguros              → formulário de interesse (vira card)
 *
 * COMPATIBILIDADE: links antigos que apontavam para "/" com parâmetros
 * de contexto (`e`, `m`, `o`, `b`, `u`, `c`, `ch`, `lead`) continuam
 * funcionando — são redirecionados para "/f" com os MESMOS parâmetros.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { GroupLandingPage } from "@/components/group/landing/group-landing-page";


type GroupSearch = {
  e?: string;
  m?: string;
  o?: string;
  u?: string;
  c?: string;
  b?: string;
  ch?: string;
  lead?: string;
};

/**
 * A URL pode entregar valores já convertidos (ex.: `g=1` vira número).
 * A leitura normaliza tudo para texto — nenhum parâmetro se perde.
 */
const str = (v: unknown) => {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): GroupSearch => ({
    e: str(search.e),
    m: str(search.m),
    o: str(search.o),
    u: str(search.u),
    c: str(search.c),
    b: str(search.b),
    ch: str(search.ch),
    lead: str(search.lead),
  }),
  beforeLoad: ({ search }) => {
    const hasContext = Object.values(search as Record<string, unknown>).some(Boolean);
    if (hasContext) {
      throw redirect({ to: "/f", replace: true, search: search as never });
    }
  },
  head: () => ({
    meta: [
      { title: "Grupo Velox — Soluções Financeiras, Solar e Seguros" },
      {
        name: "description",
        content:
          "Portal institucional do Grupo Velox: conheça a Velox Soluções Financeiras, a Velox Solar e a Velox Seguros e acesse o ambiente de cada empresa.",
      },
      { property: "og:title", content: "Grupo Velox — institucional" },
      {
        property: "og:description",
        content:
          "As três empresas do Grupo Velox em um único lugar: Soluções Financeiras, Solar e Seguros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupLandingPage,
});

