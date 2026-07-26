/**
 * Modelo de equipes — mapa userId -> teamId + gestor da equipe.
 * Fonte simulada. Superficie estavel para futura substituicao por
 * provedor externo (CRM/HRIS) sem alterar componentes.
 */
import {
  loadUsers,
  type ExecutiveRole,
  type ExecutiveSession,
  type ExecutiveUser,
} from "./executive-auth";

export type Team = { id: string; name: string; managerId: string };

export const TEAMS: Team[] = [
  { id: "team_operacional", name: "Equipe", managerId: "usr_larissa" },
];

export const OPERATIONAL_EXECUTIVE_IDS = [
  "usr_thiago",
  "usr_marton",
  "usr_paulo",
  "usr_milton",
  "usr_carlos",
  "usr_talita",
] as const;

const MEMBERSHIP: Record<string, string> = {
  usr_thiago: "team_operacional",
  usr_marton: "team_operacional",
  usr_paulo: "team_operacional",
  usr_milton: "team_operacional",
  usr_carlos: "team_operacional",
  usr_talita: "team_operacional",
};

export function teamOfUser(userId: string): Team | undefined {
  const t = MEMBERSHIP[userId];
  return TEAMS.find((x) => x.id === t);
}

export function teamMembers(teamId: string): ExecutiveUser[] {
  return loadUsers().filter(
    (u) => MEMBERSHIP[u.id] === teamId && u.status === "ativo",
  );
}

/** Colaboradores visiveis para a sessao segundo a matriz de permissoes. */
export function visibleCollaborators(session: ExecutiveSession): ExecutiveUser[] {
  const users = loadUsers().filter((u) => u.status === "ativo");
  const role: ExecutiveRole = session.activeRole;
  if (role === "super_admin" || role === "diretora") {
    return OPERATIONAL_EXECUTIVE_IDS.map((id) =>
      users.find((u) => u.id === id),
    ).filter((u): u is ExecutiveUser => Boolean(u));
  }
  return users.filter((u) => u.id === session.userId);
}

export function managedTeams(session: ExecutiveSession): Team[] {
  if (session.activeRole === "super_admin" || session.activeRole === "diretora")
    return TEAMS;
  return [];
}
