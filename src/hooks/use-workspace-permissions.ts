/**
 * ATUALIZAÇÃO ESTRUTURAL §1 — leitura reativa das permissões de módulo.
 *
 * Qualquer tela que dependa de CRM/Portal dos Leads usa este hook: quando
 * o Administrador altera a permissão no servidor, a sessão do colaborador
 * percebe a mudança sozinha (sem logout e sem F5) e a interface some ou
 * aparece na hora.
 */
import { useSyncExternalStore } from "react";
import type { ExecutiveRole } from "@/lib/executive-auth";
import {
  resolveModuleAccess,
  type WorkspaceModuleKey,
  type WorkspacePermissionMap,
} from "@/lib/workspace-permissions";
import {
  getWorkspacePermissionCache,
  startWorkspacePermissionSync,
  subscribeWorkspacePermissions,
} from "@/lib/workspace-permissions-store";

const EMPTY: WorkspacePermissionMap = {};

function subscribe(listener: () => void) {
  startWorkspacePermissionSync();
  return subscribeWorkspacePermissions(listener);
}

export function useWorkspacePermissions(): WorkspacePermissionMap {
  return useSyncExternalStore(
    subscribe,
    getWorkspacePermissionCache,
    () => EMPTY,
  );
}

export function useModuleAccess(
  userId: string,
  role: ExecutiveRole,
  moduleKey: WorkspaceModuleKey,
): boolean {
  const map = useWorkspacePermissions();
  return resolveModuleAccess(map, userId, role, moduleKey);
}
