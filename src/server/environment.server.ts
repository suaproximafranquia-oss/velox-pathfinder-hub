/** Ambiente de execução no servidor — SERVER ONLY. */
import { getRequest } from "@tanstack/react-start/server";
import { isHomologationHost, PRODUCTION_BLOCK_MESSAGE } from "@/lib/environment";

/** Host da requisição atual, quando existir. */
function currentHost(): string {
  try {
    const request = getRequest();
    if (!request) return "";
    return request.headers.get("host") ?? new URL(request.url).host;
  } catch {
    return "";
  }
}

/** Fail-closed: sem host conhecido, o ambiente é tratado como produção. */
export function isProductionRequest(): boolean {
  return !isHomologationHost(currentHost());
}

/** Barra qualquer geração de dados fictícios fora da homologação. */
export function assertHomologationOnly(): void {
  if (isProductionRequest()) throw new Error(PRODUCTION_BLOCK_MESSAGE);
}
