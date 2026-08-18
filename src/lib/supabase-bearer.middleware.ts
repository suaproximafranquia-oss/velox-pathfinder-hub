import { createMiddleware } from "@tanstack/react-start";

import { getAccessToken } from "@/lib/auth-bearer";

/**
 * Anexa o token real do backend a todas as server functions.
 *
 * Substitui o anexador gerado (`attachSupabaseAuth`), que apenas lia a
 * sessão existente: aqui a sessão é reaberta quando necessário, de forma
 * que o mesmo usuário autenticado enxergue o mesmo estado do servidor em
 * qualquer navegador ou dispositivo.
 */
export const attachAuthorizedSession = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await getAccessToken();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
