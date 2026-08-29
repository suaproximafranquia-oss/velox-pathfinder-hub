import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Link público do Portal do Investidor — MARCA + EXECUTIVO.
 * Prefixo "seg". Não abre módulo: apenas define o contexto de entrada
 * (marca e executivo responsável) e devolve o visitante à Home.
 */
export const Route = createFileRoute("/seg/$slug")({
  beforeLoad: () => {
    // Solar e Seguros são institucionais nesta versão: o link de
    // executivo apenas leva à página da unidade, sem captação.
    throw redirect({ to: "/seg", replace: true });
  },
  component: () => null,
});
