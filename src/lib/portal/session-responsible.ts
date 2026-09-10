/**
 * Especialista exibido ao investidor.
 *
 * O link personalizado continua fornecendo contexto, mas NÃO é a única
 * forma de saber quem atende: quando a sessão pertence a um investidor
 * já reconhecido pelo servidor, o responsável comercial real do cadastro
 * é a autoridade. Nada aqui altera responsável, origem ou histórico —
 * apenas escolhe quem apresentar.
 */
import { loadUsers, type ExecutiveUser } from "@/lib/executive-auth";
import { getPortalSession } from "@/lib/portal-session";
import { getResponsibleExecutive } from "@/lib/responsible-executive";

export function getSessionResponsibleExecutive(): {
  executive: ExecutiveUser | null;
  personalized: boolean;
} {
  const fallback = getResponsibleExecutive();
  if (fallback.personalized && fallback.executive) return fallback;
  const session = getPortalSession();
  const ownerId = session?.responsibleExecutiveId ?? null;
  if (!ownerId) return fallback;
  const owner = loadUsers().find((user) => user.id === ownerId) ?? null;
  return owner ? { executive: owner, personalized: true } : fallback;
}
