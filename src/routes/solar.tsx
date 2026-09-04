/**
 * Página institucional da Velox Solar (`/solar`).
 * Camada institucional pública — não é o ambiente operacional (`/s`).
 */
import { createFileRoute } from "@tanstack/react-router";
import { BrandPage } from "@/components/group/brand/brand-page";
import { BRANDS } from "@/components/group/brand/brand-content";

const brand = BRANDS.solar;

export const Route = createFileRoute("/solar")({
  head: () => ({
    meta: [
      { title: brand.seo.title },
      { name: "description", content: brand.seo.description },
      { property: "og:title", content: brand.seo.title },
      { property: "og:description", content: brand.seo.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SolarPage,
});

function SolarPage() {
  return <BrandPage brand={brand} />;
}
