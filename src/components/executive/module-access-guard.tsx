/**
 * COMANDO 3B §11 — autorização real de módulo.
 *
 * Esconder o botão nunca é a única proteção: este guard bloqueia o acesso
 * direto por URL e impede que os componentes/dados do módulo sejam sequer
 * carregados para um usuário sem permissão.
 */
import { Lock } from "lucide-react";
import type { ExecutiveSession } from "@/lib/executive-auth";
import {
  WORKSPACE_MODULE_LABEL,
  canUseWorkspaceModule,
  type WorkspaceModuleKey,
} from "@/lib/workspace-permissions";

export function hasModuleAccess(
  session: ExecutiveSession,
  moduleKey: WorkspaceModuleKey,
): boolean {
  return canUseWorkspaceModule(session.userId, session.activeRole, moduleKey);
}

export function ModuleAccessGuard({
  session,
  moduleKey,
  children,
}: {
  session: ExecutiveSession;
  moduleKey: WorkspaceModuleKey;
  children: React.ReactNode;
}) {
  if (hasModuleAccess(session, moduleKey)) return <>{children}</>;
  return <ModuleAccessDenied moduleKey={moduleKey} />;
}

export function ModuleAccessDenied({ moduleKey }: { moduleKey: WorkspaceModuleKey }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-6 text-[color:var(--foreground)]">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--border)] text-[color:var(--muted-foreground)]">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="font-display text-xl">Acesso não disponível</h1>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          O módulo {WORKSPACE_MODULE_LABEL[moduleKey]} não está disponível para o seu usuário.
          Solicite a liberação ao Administrador do Workspace.
        </p>
      </div>
    </div>
  );
}
