import { createFileRoute, redirect } from "@tanstack/react-router";
import { clearResponsibleExecutive } from "@/lib/responsible-executive";

/**
 * Manual Público (`/manual`) — entrada por Google, Instagram, QR Code, site
 * ou acesso direto. Nunca é personalizado: garante que qualquer slug
 * previamente persistido seja limpo, para que todos os leads recaiam sobre
 * o Executivo Padrão do workspace (Thiago Rodrigues).
 */
export const Route = createFileRoute("/manual/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") clearResponsibleExecutive();
    throw redirect({ to: "/" });
  },
  component: () => null,
});