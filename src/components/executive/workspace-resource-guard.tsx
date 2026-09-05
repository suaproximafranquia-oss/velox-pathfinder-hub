/**
 * Guard de rota do Corporate Workspace — usa A MESMA decisão do servidor.
 *
 * Nenhuma tela repete regra de papel: o acesso direto por URL passa pela
 * camada central (`workspace-authorization`), exatamente como as server
 * functions do módulo.
 */
import { Lock } from "lucide-react";
import { useWorkspaceResourceAccess } from "@/hooks/use-workspace-authorization";
import {
  WORKSPACE_RESOURCE_LABEL,
  type WorkspaceResource,
} from "@/lib/workspace-authorization";

export function WorkspaceResourceGuard({
  resource,
  children,
}: {
  resource: WorkspaceResource;
  children: React.ReactNode;
}) {
  const allowed = useWorkspaceResourceAccess(resource);
  if (allowed === null) return null;
  if (allowed) return <>{children}</>;
  return <WorkspaceResourceDenied resource={resource} />;
}

export function WorkspaceResourceDenied({ resource }: { resource: WorkspaceResource }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-[color:var(--foreground)]">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--border)] text-[color:var(--muted-foreground)]">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="font-display text-xl">Acesso não disponível</h1>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          {WORKSPACE_RESOURCE_LABEL[resource]} não está disponível para o seu usuário.
          Solicite a liberação ao Administrador do Workspace.
        </p>
      </div>
    </div>
  );
}
