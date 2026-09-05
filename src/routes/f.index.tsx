import { createFileRoute } from "@tanstack/react-router";
import { assetUrl } from "@/lib/assets/registry";
import { InvestorPortalHome } from "@/components/portal/investor-portal-home";

/**
 * `/f` — Portal do Investidor da Velox Soluções Financeiras.
 *
 * O corpo da página vive em `InvestorPortalHome`, base única do Portal
 * do Investidor. Esta rota apenas informa a marca e a própria Home; os
 * metadados permanecem exatamente como sempre foram.
 */
const heroImg = { url: assetUrl("portal-hero-sede") };

type HomeSearch = {
  /** Executivo responsável (link personalizado). */
  e?: string;
  /** Módulo a abrir sobre a Home após o Gateway. */
  m?: string;
  /** Origem da visita. */
  o?: string;
  /** Unidade. */
  u?: string;
  /** Campanha. */
  c?: string;
  /** Marca/operação de origem (`financeira`, `solar`, `seguros`). */
  b?: string;
  /** COMANDO 3 §8 — canal oficial de origem (`tiktok` | `meta`). */
  ch?: string;
  /** FASE 1 §6 — visitante chegou pelo Portal Institucional do Grupo. */
  g?: string;
};

/**
 * A URL pode entregar valores já convertidos (ex.: `g=1` vira número).
 * A leitura normaliza tudo para texto — nenhum parâmetro se perde.
 */
const str = (v: unknown) => {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

export const Route = createFileRoute("/f/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
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
      { title: "Portal Velox — Ecossistema institucional Velox Soluções Financeiras" },
      {
        name: "description",
        content:
          "Portal Velox: a porta de entrada do ecossistema Velox — Manual do Investidor, Universo Velox, Nossa Estrutura, Notícias, Experiências e Área Executiva em uma única plataforma.",
      },
      { property: "og:title", content: "Portal Velox — Ecossistema institucional" },
      {
        property: "og:description",
        content:
          "Recepção institucional da Velox Soluções Financeiras. Conheça o Manual do Investidor, o Universo Velox, nossa sede, notícias e experiências.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: heroImg.url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: heroImg.url },
    ],
    links: [{ rel: "preload", as: "image", href: heroImg.url }],
  }),
  component: () => <InvestorPortalHome brandKey="financeira" homePath="/f" />,
});
