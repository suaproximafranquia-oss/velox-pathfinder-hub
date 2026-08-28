import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";

/**
 * GUARD ÚNICO DOS AMBIENTES OPERACIONAIS (`/f/...`).
 *
 * Um só ponto decide se a tela interna pode ser renderizada:
 *  - enquanto a sessão não foi lida, NADA é renderizado (sem piscar de
 *    conteúdo interno);
 *  - sem sessão, o usuário é levado à tela de acesso já existente
 *    (`/f/executivo`), sem criar uma nova página de login;
 *  - com sessão, o ambiente é renderizado normalmente.
 *
 * As telas filhas não precisam repetir esta verificação.
 */
export function OperationalGuard({
  children,
  /** Caminhos públicos dentro do ambiente (ex.: a própria tela de acesso). */
  publicPaths = [],
}: {
  children: ReactNode;
  publicPaths?: readonly string[];
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [checked, setChecked] = useState(false);

  const isPublic = publicPaths.includes(pathname.replace(/\/+$/, "") || "/");

  useEffect(() => {
    const s = getSession();
    setSession(s);
    setChecked(true);
    if (!s && !isPublic) {
      navigate({ to: "/f/executivo", replace: true });
    }
  }, [isPublic, navigate, pathname]);

  if (isPublic) return <>{children}</>;
  if (!checked || !session) return null;
  return <>{children}</>;
}
