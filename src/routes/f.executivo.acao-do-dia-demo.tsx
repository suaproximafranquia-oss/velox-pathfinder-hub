import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota legada da demonstração da Ação do Dia.
 *
 * A demonstração passou a viver dentro da CENTRAL DE HOMOLOGAÇÃO. O
 * caminho antigo continua funcionando por redirecionamento controlado,
 * sem duplicar componente nem lógica.
 */
export const Route = createFileRoute("/f/executivo/acao-do-dia-demo")({
  beforeLoad: () => {
    throw redirect({ to: "/f/executivo/homologacao/acao-do-dia", replace: true });
  },
  component: () => null,
});
