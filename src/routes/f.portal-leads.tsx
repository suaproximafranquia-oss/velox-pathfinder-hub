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
import { ModuleAccessDenied } from "@/components/executive/module-access-guard";
import { useModuleAccess } from "@/hooks/use-workspace-permissions";

export const Route = createFileRoute("/f/portal-leads")({
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
      navigate({ to: "/f/executivo" });
      return;
    }
    setSession(s);
    // Garante a sessão real do backend antes de qualquer consulta.
    void import("@/lib/auth-bearer")
      .then(({ getAccessToken }) => getAccessToken())
      .finally(() => setReady(true));
  }, [navigate]);

  const portalAllowed = useModuleAccess(
    session?.userId ?? "",
    session?.activeRole ?? "executivo",
    "portal_leads",
  );



  // ATUALIZAÇÃO ESTRUTURAL §1 — autorização reativa vinda do servidor:
  // acesso direto por URL é bloqueado e a revogação vale na hora.
  if (!ready || !session) return null;
  if (!portalAllowed) {
    return <ModuleAccessDenied moduleKey="portal_leads" />;
  }
  return <PortalLeadsBoard standalone />;
}
