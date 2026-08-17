/**
 * COMANDO 3B §1 — painel "Permissões do Workspace".
 *
 * Referente EXCLUSIVAMENTE ao usuário selecionado. Controla apenas dois
 * módulos: CRM (com o Backup de Conversas dependente) e Portal dos Leads.
 */
import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { ROLE_LABEL, type ExecutiveUser } from "@/lib/executive-auth";
import {
  WORKSPACE_MODULE_LABEL,
  loadWorkspacePermissions,
  resolveModuleAccess,
  setWorkspaceModuleAccess,
  type WorkspaceModuleKey,
} from "@/lib/workspace-permissions";

export function WorkspacePermissionsDialog({
  user,
  onClose,
}: {
  user: ExecutiveUser;
  onClose: () => void;
}) {
  const [map, setMap] = useState(() => loadWorkspacePermissions());

  const value = (key: WorkspaceModuleKey) =>
    resolveModuleAccess(map, user.id, user.role, key);

  function toggle(key: WorkspaceModuleKey) {
    const next = !value(key);
    const label = WORKSPACE_MODULE_LABEL[key];
    const extra = key === "crm" ? " O Backup de Conversas acompanha esta decisão." : "";
    const ok = window.confirm(
      next
        ? `Liberar o módulo ${label} para ${user.name}?${extra}`
        : `Remover o acesso ao módulo ${label} de ${user.name}?${extra}`,
    );
    if (!ok) return;
    setMap(setWorkspaceModuleAccess(user.id, key, next));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--navy-deep)]/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-lg">Permissões do Workspace</h3>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Configuração individual deste usuário.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/30 p-4 text-sm">
          <Info label="Nome" value={user.name} />
          <Info label="E-mail" value={user.email} />
          <Info label="Perfil" value={ROLE_LABEL[user.role]} />
          <Info label="Status" value={user.status === "ativo" ? "Ativo" : "Inativo"} />
        </dl>

        <div className="space-y-3">
          {(["crm", "portal_leads"] as WorkspaceModuleKey[]).map((key) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl border border-[color:var(--border)] px-4 py-3"
            >
              <div>
                <p className="text-sm">{WORKSPACE_MODULE_LABEL[key]}</p>
                {key === "crm" ? (
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    O Backup de Conversas depende deste módulo.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={value(key)}
                aria-label={`${WORKSPACE_MODULE_LABEL[key]} — ${value(key) ? "ON" : "OFF"}`}
                onClick={() => toggle(key)}
                className={
                  "cursor-pointer rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.18em] transition " +
                  (value(key)
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)]")
                }
              >
                {value(key) ? "On" : "Off"}
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-1 break-all text-sm">{value}</dd>
    </div>
  );
}
