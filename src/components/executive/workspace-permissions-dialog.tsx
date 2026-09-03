/**
 * COMANDO 3B §1 — painel "Permissões do Workspace".
 *
 * Referente EXCLUSIVAMENTE ao usuário selecionado. Agrupa módulos
 * (CRM / Portal dos Leads) e a regra de automação do primeiro contato
 * E0, que depende dos dois módulos ativos.
 */
import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { ROLE_LABEL, type ExecutiveUser } from "@/lib/executive-auth";
import {
  WORKSPACE_MODULE_LABEL,
  canEnableE0Automatic,
  resolveModuleAccess,
  setWorkspaceModuleAccess,
  type WorkspaceModuleKey,
} from "@/lib/workspace-permissions";
import { useWorkspacePermissions } from "@/hooks/use-workspace-permissions";

export function WorkspacePermissionsDialog({
  user,
  onClose,
}: {
  user: ExecutiveUser;
  onClose: () => void;
}) {
  const map = useWorkspacePermissions();
  const [saving, setSaving] = useState<WorkspaceModuleKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const value = (key: WorkspaceModuleKey) =>
    resolveModuleAccess(map, user.id, user.role, key);

  /** Matriz: automático exige CRM ON e Portal dos Leads ON. */
  const automaticAllowed = canEnableE0Automatic(map, user.id, user.role);
  const e0Automatic = automaticAllowed && value("e0_automatico");

  /**
   * ATUALIZAÇÃO ESTRUTURAL §1 — a decisão é gravada no SERVIDOR. Só
   * consideramos a permissão alterada quando o banco confirma; as demais
   * sessões percebem a mudança automaticamente.
   */
  async function toggle(key: WorkspaceModuleKey) {
    const next = key === "e0_automatico" ? !e0Automatic : !value(key);
    if (key === "e0_automatico" && next && !automaticAllowed) return;
    const label = WORKSPACE_MODULE_LABEL[key];
    const extra =
      key === "crm"
        ? " O Backup de Conversas acompanha esta decisão." +
          (e0Automatic && !next
            ? " O primeiro contato automático deste executivo passará a MANUAL."
            : "")
        : key === "portal_leads" && e0Automatic && !next
          ? " O primeiro contato automático deste executivo passará a MANUAL."
          : "";
    const ok = window.confirm(
      key === "e0_automatico"
        ? next
          ? `Colocar o primeiro contato (E0) de ${user.name} em AUTOMÁTICO?`
          : `Colocar o primeiro contato (E0) de ${user.name} em MANUAL?`
        : next
          ? `Liberar o módulo ${label} para ${user.name}?${extra}`
          : `Remover o acesso ao módulo ${label} de ${user.name}?${extra}`,
    );
    if (!ok) return;
    setSaving(key);
    setError(null);
    try {
      await setWorkspaceModuleAccess(user.id, key, next);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível gravar a permissão no servidor. Nada foi alterado.",
      );
    } finally {
      setSaving(null);
    }
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
          {(["crm", "portal_leads", "e0_automatico"] as WorkspaceModuleKey[]).map((key) => {
            const isE0 = key === "e0_automatico";
            const on = isE0 ? e0Automatic : value(key);
            const blocked = isE0 && !automaticAllowed;
            return (
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
                  {isE0 ? (
                    <p className="text-[11px] text-[color:var(--muted-foreground)]">
                      {blocked
                        ? "Automático indisponível: exige CRM e Portal dos Leads ligados."
                        : "Automático executa na entrada do lead; manual vira ação prioritária na Ação do Dia."}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${WORKSPACE_MODULE_LABEL[key]} — ${
                    isE0 ? (on ? "Automático" : "Manual") : on ? "ON" : "OFF"
                  }`}
                  disabled={saving === key || blocked}
                  onClick={() => void toggle(key)}
                  className={
                    "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-50 " +
                    (on
                      ? "cursor-pointer border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "cursor-pointer border-red-500/40 bg-red-500/10 text-red-400")
                  }
                >
                  <span
                    aria-hidden
                    className={
                      "h-2 w-2 rounded-full " + (on ? "bg-emerald-400" : "bg-red-400")
                    }
                  />
                  {isE0 ? (on ? "Automático" : "Manual") : on ? "On" : "Off"}
                </button>
              </div>
            );
          })}
        </div>

        {error ? (
          <p className="text-xs text-[color:var(--destructive)]">{error}</p>
        ) : (
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            A permissão é gravada no servidor e vale imediatamente em todas as sessões.
          </p>
        )}

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
