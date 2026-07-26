import { createFileRoute, redirect } from "@tanstack/react-router";
import { clearResponsibleExecutive } from "@/lib/responsible-executive";

/**
 * Manual de Tráfego Pago (`/manual/anuncio`) — entrada por campanhas
 * patrocinadas. Também não é personalizado: leads pertencem ao Executivo
 * Padrão do workspace.
 */
export const Route = createFileRoute("/manual/anuncio")({
  beforeLoad: () => {
    if (typeof window !== "undefined") clearResponsibleExecutive();
    throw redirect({ to: "/" });
  },
  component: () => null,
});