import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OperationalGuard } from "@/components/auth/operational-guard";

/**
 * `/f/executivo` — layout do Workspace (Central do Executivo).
 *
 * Guard único de todo o ramo: nenhuma tela filha precisa repetir a
 * verificação de sessão. A própria tela de acesso (`/f/executivo`)
 * permanece pública — é para ela que o guard redireciona.
 *
 * `ssr: false`: a sessão do Workspace vive no navegador; renderizar no
 * servidor produziria um quadro sem sessão e um "pisca" de conteúdo.
 */
export const Route = createFileRoute("/f/executivo")({
  ssr: false,
  component: () => (
    <OperationalGuard publicPaths={["/f/executivo"]}>
      <Outlet />
    </OperationalGuard>
  ),
});
