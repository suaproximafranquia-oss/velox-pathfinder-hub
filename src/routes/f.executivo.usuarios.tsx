import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Power, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { WorkspacePermissionsDialog } from "@/components/executive/workspace-permissions-dialog";
import {
  getSession,
  loadUsers,
  saveUsers,
  newUserId,
  canManageUsers,
  canManageTargetUser,
  assignableRoles,
  ROLE_LABEL,
  type ExecutiveSession,
  type ExecutiveUser,
  type ExecutiveRole,
} from "@/lib/executive-auth";
import { setExecutiveStatus } from "@/lib/executive-status.functions";
import { ACTIVE_WORKSPACE_ID } from "@/config/workspace";


export const Route = createFileRoute("/f/executivo/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsuariosPage,
});

type Draft = Omit<ExecutiveUser, "id"> & { id?: string };

const emptyDraft: Draft = {
  workspaceId: ACTIVE_WORKSPACE_ID,
  name: "",
  email: "",
  phone: "",
  birthDate: "",
  username: "",
  password: "",
  slug: "",
  role: "executivo",
  status: "ativo",
};

function slugifyEmail(email: string): { username: string; slug: string } {
  const local = (email.split("@")[0] || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = local.replace(/\./g, "-") || "usuario";
  return { username: local || "usuario", slug };
}

function UsuariosPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [users, setUsers] = useState<ExecutiveUser[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [permissionsFor, setPermissionsFor] = useState<ExecutiveUser | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    if (!canManageUsers(s.activeRole)) {
      navigate({ to: "/executivo/dashboard" });
      return;
    }
    setSession(s);
    setUsers(loadUsers());
  }, [navigate]);

  function persist(next: ExecutiveUser[]) {
    setUsers(next);
    saveUsers(next);
  }

  function toggleStatus(id: string) {
    const target = users.find((u) => u.id === id);
    if (!target || !session) return;
    if (!canManageTargetUser(session.activeRole, target.role)) return;
    const next = target.status === "ativo" ? "inativo" : "ativo";
    if (
      !confirm(
        next === "ativo"
          ? `Ativar o usuário ${target.name}?`
          : `Desativar o usuário ${target.name}?`,
      )
    ) {
      return;
    }
    persist(
      users.map((u) =>
        u.id === id ? { ...u, status: next } : u,
      ),
    );
    // §13/§14 — a situação vale no SERVIDOR: a sessão do usuário
    // desativado é encerrada e um novo login é recusado. Nenhum
    // histórico, conversa ou lead é apagado (§16).
    void setExecutiveStatus({
      data: { executiveId: id, status: next, actorName: session.name },
    }).catch(() => {
      alert("Não foi possível registrar a alteração no servidor. Tente novamente.");
    });
  }

  function remove(id: string) {
    const target = users.find((u) => u.id === id);
    if (!target || !session) return;
    if (!canManageTargetUser(session.activeRole, target.role)) return;
    if (!confirm("Excluir este usuário?")) return;
    persist(users.filter((u) => u.id !== id));
  }

  function saveDraft() {
    if (!draft || !session) return;
    if (!draft.name || !draft.email) return;
    // Validação de perfil atribuído — Gestor não pode atribuir Administrador.
    if (!assignableRoles(session.activeRole).includes(draft.role)) return;
    if (draft.id) {
      const existing = users.find((u) => u.id === draft.id);
      if (!existing) return;
      if (!canManageTargetUser(session.activeRole, existing.role)) return;
    }
    const { username, slug } = slugifyEmail(draft.email);
    const complete: Draft = {
      ...draft,
      username,
      slug,
    };
    if (draft.id) {
      persist(users.map((u) => (u.id === draft.id ? { ...(complete as ExecutiveUser) } : u)));
    } else {
      const created: ExecutiveUser = {
        ...(complete as ExecutiveUser),
        id: newUserId(),
        password: complete.password || "senha123",
      };
      persist([...users, created]);
    }
    setDraft(null);
  }

  if (!session) return null;

  const actorRole: ExecutiveRole = session.activeRole;
  const roleOptions = assignableRoles(actorRole);

  return (
    <ExecutiveShell session={session} title="Gestão de usuários">
      <div className="flex justify-end mb-5">
        <button
          type="button"
          onClick={() =>
            setDraft({
              ...emptyDraft,
              role: roleOptions[roleOptions.length - 1] ?? "executivo",
            })
          }
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-4 py-2 text-sm text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition"
        >
          <Plus className="h-4 w-4" /> Adicionar usuário
        </button>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            <tr className="border-b border-[color:var(--border)]">
              <th className="text-left px-4 py-3 font-normal">Nome</th>
              <th className="text-left px-4 py-3 font-normal">E-mail Corporativo</th>
              <th className="text-left px-4 py-3 font-normal">Perfil</th>
              <th className="text-left px-4 py-3 font-normal">Status</th>
              <th className="text-right px-4 py-3 font-normal">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[color:var(--border)]/60 last:border-0">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{u.email}</td>
                <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs " +
                      (u.status === "ativo"
                        ? "border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 text-[color:var(--gold)]"
                        : "border-[color:var(--border)] text-[color:var(--muted-foreground)]")
                    }
                  >
                    {u.status === "ativo" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {canManageTargetUser(actorRole, u.role) ? (
                      <>
                        <button
                          onClick={() => setDraft({ ...u })}
                          title="Editar"
                          className="rounded-lg p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)]/60"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPermissionsFor(u)}
                          title="Permissões do Workspace"
                          className="rounded-lg p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)]/60"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleStatus(u.id)}
                          title={u.status === "ativo" ? "Desativar" : "Ativar"}
                          className="rounded-lg p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)]/60"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(u.id)}
                          title="Excluir"
                          className="rounded-lg p-2 text-[color:var(--muted-foreground)] hover:text-red-400 hover:bg-[color:var(--accent)]/60"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] px-2">
                        Somente Administrador
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {permissionsFor && (
        <WorkspacePermissionsDialog
          user={permissionsFor}
          onClose={() => setPermissionsFor(null)}
        />
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--navy-deep)]/70 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] p-6 space-y-4">
            <h3 className="font-display text-lg">
              {draft.id ? "Editar usuário" : "Adicionar usuário"}
            </h3>
            <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
              Ao criar um novo usuário, a Atlas Platform provisiona automaticamente
              perfil, permissões, estrutura do Workspace e área individual, sem
              necessidade de configuração manual.
            </p>
            {(
              [
                ["name", "Nome", "text", "Ex.: Ana Souza"],
                ["email", "E-mail Corporativo", "email", "nome@empresa.com.br"],
                ["phone", "Telefone", "tel", "(11) 90000-0000"],
                ["birthDate", "Data de nascimento", "date", ""],
                ["password", "Senha Inicial", "text", "Definir senha temporária"],
              ] as const
            ).map(([field, label, type, placeholder]) => (
              <div key={field}>
                <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1.5">
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={(draft as Record<string, string>)[field] ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [field]: e.target.value } as Draft)
                  }
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50 placeholder:text-[color:var(--muted-foreground)]/50"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1.5">
                  Perfil
                </label>
                <select
                  value={draft.role}
                  onChange={(e) =>
                    setDraft({ ...draft, role: e.target.value as ExecutiveUser["role"] })
                  }
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1.5">
                  Status
                </label>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as ExecutiveUser["status"] })
                  }
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-4 py-2 text-sm text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition"
              >
                {draft.id ? "Salvar alterações" : "Criar Usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ExecutiveShell>
  );
}