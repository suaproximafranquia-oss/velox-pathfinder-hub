/**
 * Ambiente de execução do Portal Velox.
 *
 * PRODUÇÃO é o ambiente oficial: nenhum dado fictício, seed, mock,
 * exemplo ou registro de demonstração pode ser criado. Massas de teste
 * existem exclusivamente em HOMOLOGAÇÃO (preview e desenvolvimento).
 *
 * A regra é "fail-closed": na dúvida, o ambiente é tratado como
 * produção e a geração automática de dados fica bloqueada.
 */

/** Hosts reconhecidos como ambiente de homologação/desenvolvimento. */
export function isHomologationHost(host: string): boolean {
  const h = (host ?? "").toLowerCase();
  if (!h) return false;
  if (h.startsWith("localhost") || h.startsWith("127.0.0.1") || h.startsWith("0.0.0.0")) return true;
  if (h.startsWith("id-preview--")) return true;
  if (h.includes("-dev.lovable.app")) return true;
  if (h.endsWith(".lovableproject.com")) return true;
  return false;
}

/** Verdadeiro apenas no ambiente oficial publicado. */
export function isProductionEnvironment(): boolean {
  if (typeof window === "undefined") return true;
  return !isHomologationHost(window.location.host);
}

/** Atalho de leitura para as telas de simulação. */
export function isHomologationEnvironment(): boolean {
  return !isProductionEnvironment();
}

export const PRODUCTION_BLOCK_MESSAGE =
  "Recurso disponível apenas em homologação. Em produção o Portal opera exclusivamente com dados reais.";
