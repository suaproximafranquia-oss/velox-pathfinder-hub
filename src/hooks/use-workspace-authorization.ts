/**
 * Leitura da autorização única do Corporate Workspace na interface.
 *
 * Enquanto o servidor não responde, nada é liberado (fail-closed): o
 * menu não pode conceder o que o servidor negaria.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  autorizacaoWorkspace,
  type WorkspaceAuthorizationSnapshot,
} from "@/lib/workspace-authorization.functions";
import type { WorkspaceResource } from "@/lib/workspace-authorization";

export function useWorkspaceAuthorization(): WorkspaceAuthorizationSnapshot | null {
  const read = useServerFn(autorizacaoWorkspace);
  const [snapshot, setSnapshot] = useState<WorkspaceAuthorizationSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = (await read({
          data: undefined as never,
        })) as WorkspaceAuthorizationSnapshot;
        if (active) setSnapshot(result ?? null);
      } catch {
        if (active) setSnapshot(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [read]);

  return snapshot;
}

/** `null` = ainda carregando; `false` = negado pelo servidor. */
export function useWorkspaceResourceAccess(
  resource: WorkspaceResource,
): boolean | null {
  const snapshot = useWorkspaceAuthorization();
  if (!snapshot) return null;
  return snapshot.allowed[resource] === true;
}
