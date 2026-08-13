/**
 * Portal dos Leads — quadro Kanban em aba própria (largura total).
 *
 * Reutiliza exatamente o mesmo componente e serviços já implementados;
 * apenas remove o restante da interface do Portal para dar largura ao
 * quadro. Continua somente leitura: a movimentação real é na origem.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PortalLeadsBoard } from "@/components/crm/portal-leads-board";

export const Route = createFileRoute("/portal-leads")({
  head: () => ({
    meta: [
      { title: "Portal dos Leads — Velox" },
      {
        name: "description",
        content:
          "Quadro visual dos leads da captação Velox, sincronizado com a origem e somente leitura.",
      },
      { property: "og:title", content: "Portal dos Leads — Velox" },
      {
        property: "og:description",
        content: "Kanban dos leads da captação Velox em painel dedicado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalLeadsPage,
});

function PortalLeadsPage() {
  return <PortalLeadsBoard standalone />;
}
