import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { getSession, signOut, type ExecutiveSession } from "@/lib/executive-auth";
import { unitPath } from "@/lib/business-unit";
import { startExecutiveDirectorySync } from "@/lib/executive-directory";


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
      navigate({ to: unitPath("/executivo"), replace: true });
    }
  }, [isPublic, navigate, pathname]);

  /**
   * §2 — SITUAÇÃO ATIVO/INATIVO VALE NA SESSÃO VIVA.
   *
   * Não basta recusar o próximo login: enquanto a aba está aberta, o
   * servidor é consultado periodicamente. Se o Administrador desligou o
   * acesso, a sessão é encerrada imediatamente. Falha de rede NUNCA
   * desloga — só uma resposta explícita de "inativo" encerra.
   */
  useEffect(() => {
    if (isPublic || !session) return;
    let cancelled = false;
    startExecutiveDirectorySync();

    const check = async () => {
      try {
        const { situacaoOperacional } = await import("@/lib/executive-directory.functions");
        const result = await situacaoOperacional({ data: { executiveId: session.userId } });
        if (cancelled || result.active || !result.known) return;
        signOut();
        setSession(null);
        navigate({ to: unitPath("/executivo"), replace: true });
      } catch {
        /* servidor indisponível: mantém o acesso atual */
      }
    };

    void check();
    const timer = setInterval(() => void check(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isPublic, navigate, session]);

  if (isPublic) return <>{children}</>;
  if (!checked || !session) return null;
  return <>{children}</>;
}

