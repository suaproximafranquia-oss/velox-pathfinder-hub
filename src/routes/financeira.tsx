/**
 * Página institucional da Velox Soluções Financeiras (`/financeira`).
 * Camada institucional pública — não é o Portal do Investidor (`/f`).
 */
import { createFileRoute } from "@tanstack/react-router";
import { BrandPage } from "@/components/group/brand/brand-page";
import { BRANDS } from "@/components/group/brand/brand-content";

const brand = BRANDS.financeira;

export const Route = createFileRoute("/financeira")({
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
  component: FinanceiraPage,
});

function FinanceiraPage() {
  return <BrandPage brand={brand} />;
}
