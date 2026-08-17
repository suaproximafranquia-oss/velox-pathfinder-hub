/**
 * Portal dos Leads — quadro Kanban em aba própria (largura total).
 *
 * Reutiliza exatamente o mesmo componente e serviços já implementados;
 * apenas remove o restante da interface do Portal para dar largura ao
 * quadro. Continua somente leitura: a movimentação real é na origem.
 */
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PortalLeadsBoard } from "@/components/crm/portal-leads-board";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { ModuleAccessDenied, hasModuleAccess } from "@/components/executive/module-access-guard";

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
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
    setReady(true);
  }, [navigate]);

  // COMANDO 3B §4/§11 — acesso direto por URL é bloqueado e nenhum dado
  // do Portal dos Leads é carregado sem permissão individual.
  if (!ready || !session) return null;
  if (!hasModuleAccess(session, "portal_leads")) {
    return <ModuleAccessDenied moduleKey="portal_leads" />;
  }
  return <PortalLeadsBoard standalone />;
}
