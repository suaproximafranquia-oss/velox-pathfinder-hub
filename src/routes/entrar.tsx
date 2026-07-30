import { createFileRoute, redirect } from "@tanstack/react-router";
import { moduleForPath } from "@/lib/portal-modules";

/**
 * `/entrar` — rota legada do Gateway.
 *
 * Na arquitetura oficial do Portal Velox o Gateway deixou de ser uma
 * página: ele é um overlay da Home. Esta rota permanece apenas para
 * compatibilidade com links antigos e converte os parâmetros recebidos
 * em contexto de sessão, devolvendo o visitante à Home.
 */
export const Route = createFileRoute("/entrar")({
  beforeLoad: ({ search }) => {
    const s = search as Record<string, unknown>;
    const next = typeof s.next === "string" ? s.next : "/manual";
    throw redirect({
      to: "/",
      replace: true,
      search: {
        m: moduleForPath(next)?.key ?? "manual",
        e: typeof s.executive === "string" ? s.executive : undefined,
        o: typeof s.origin === "string" ? s.origin : undefined,
      },
    });
  },
  component: () => null,
});
