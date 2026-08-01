/**
 * CRM de Relacionamento — camada de permissões sobre a base única.
 *
 * Os dados pertencem ao ecossistema; a visualização pertence às
 * permissões. Existem três modos de leitura:
 *
 *  - `completo`     → o Executivo responsável (e o Administrador) opera
 *                     integralmente o relacionamento;
 *  - `supervisao`   → o Gestor vê responsável, origem, status e situação
 *                     operacional, jamais o conteúdo privado;
 *  - `bloqueado`    → o investidor pertence a outro Executivo: nenhuma
 *                     informação privada é exibida.
 */
import type { ExecutiveRole } from "@/lib/executive-auth";
import type { CrmActor } from "@/lib/crm/types";

export type CrmAccessMode = "completo" | "supervisao" | "bloqueado";

export const CRM_ACCESS_LABEL: Record<CrmAccessMode, string> = {
  completo: "Relacionamento próprio",
  supervisao: "Visão administrativa",
  bloqueado: "Relacionamento de outro Executivo",
};

/** Administrador opera o CRM integralmente; Gestor apenas supervisiona. */
export function isCrmAdministrator(role: ExecutiveRole): boolean {
  return role === "super_admin";
}

export function isCrmSupervisor(role: ExecutiveRole): boolean {
  return role === "diretora";
}

export function accessModeFor(actor: CrmActor, ownerId: string): CrmAccessMode {
  if (ownerId === actor.userId) return "completo";
  if (isCrmAdministrator(actor.role)) return "completo";
  if (isCrmSupervisor(actor.role)) return "supervisao";
  return "bloqueado";
}

/** Conteúdo privado: mensagens, áudios, arquivos, Timeline, Portal, IA, notas. */
export function canSeePrivateContent(mode: CrmAccessMode): boolean {
  return mode === "completo";
}
