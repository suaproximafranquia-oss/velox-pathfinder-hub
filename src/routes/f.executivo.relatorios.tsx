import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Relatórios foi consolidado dentro do Brain Analytics. Esta rota
 * permanece apenas para não quebrar links/favoritos antigos.
 */
export const Route = createFileRoute("/f/executivo/relatorios")({
  component: RelatoriosRedirect,
});

function RelatoriosRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/f/executivo/brain", replace: true });
  }, [navigate]);
  return null;
}
