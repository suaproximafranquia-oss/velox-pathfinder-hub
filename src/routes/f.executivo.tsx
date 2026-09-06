import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OperationalGuard } from "@/components/auth/operational-guard";
import { ExecutiveShellFrame } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";

/**
 * `/f/executivo` — layout do Workspace (Central do Executivo).
 *
 * Guard único de todo o ramo: nenhuma tela filha precisa repetir a
 * verificação de sessão. A própria tela de acesso (`/f/executivo`)
 * permanece pública — é para ela que o guard redireciona.
 *
 * SHELL PERSISTENTE: o `ExecutiveShellFrame` (header, menu lateral e
 * rodapé) é montado AQUI, uma única vez, e permanece vivo durante toda a
 * navegação interna. A troca de rota altera somente o `<Outlet />`.
 * As páginas continuam declarando seu título por `<ExecutiveShell>`, que
 * dentro do frame apenas informa título/fullBleed — sem redesenhar o menu.
 *
 * `ssr: false`: a sessão do Workspace vive no navegador; renderizar no
 * servidor produziria um quadro sem sessão e um "pisca" de conteúdo.
 */
export const Route = createFileRoute("/f/executivo")({
  ssr: false,
  component: () => (
    <OperationalGuard publicPaths={["/f/executivo"]}>
      <ExecutiveWorkspaceLayout />
    </OperationalGuard>
  ),
});

function ExecutiveWorkspaceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = (pathname.replace(/\/+$/, "") || "/") === "/f/executivo";
  const [session, setSession] = useState<ExecutiveSession | null>(() => getSession());

  // A sessão é lida no navegador; após o login a própria tela de acesso
  // navega para a Home e o shell passa a existir.
  useEffect(() => {
    setSession(getSession());
  }, [pathname]);

  // Tela de acesso e estado sem sessão continuam exatamente como antes.
  if (isLogin || !session) return <Outlet />;

  return (
    <ExecutiveShellFrame session={session}>
      <Outlet />
    </ExecutiveShellFrame>
  );
}
