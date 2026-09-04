/**
 * Página institucional da Velox Seguros (`/seguradora`).
 * Camada institucional pública — não é o ambiente operacional (`/seg`).
 */
import { createFileRoute } from "@tanstack/react-router";
import { BrandPage } from "@/components/group/brand/brand-page";
import { BRANDS } from "@/components/group/brand/brand-content";

const brand = BRANDS.seguros;

export const Route = createFileRoute("/seguradora")({
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
  component: SeguradoraPage,
});

function SeguradoraPage() {
  return <BrandPage brand={brand} />;
}
