import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Power, Plus, Trash2 } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  loadUsers,
  saveUsers,
  newUserId,
  canManageUsers,
  ROLE_LABEL,
  type ExecutiveSession,
  type ExecutiveUser,
} from "@/lib/executive-auth";
import { ACTIVE_WORKSPACE_ID } from "@/config/workspace";

export const Route = createFileRoute("/executivo/usuarios")({
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
  username: "",
  password: "",
  slug: "",
  role: "executivo",
  status: "ativo",
};

function UsuariosPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [users, setUsers] = useState<ExecutiveUser[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    if (!canManageUsers(s.role)) {
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
    persist(
      users.map((u) =>
        u.id === id ? { ...u, status: u.status === "ativo" ? "inativo" : "ativo" } : u,
      ),
    );
  }

  function remove(id: string) {
    if (!confirm("Excluir este usuário?")) return;
    persist(users.filter((u) => u.id !== id));
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.name || !draft.username || !draft.slug) return;
    if (draft.id) {
      persist(users.map((u) => (u.id === draft.id ? { ...(draft as ExecutiveUser) } : u)));
    } else {
      const created: ExecutiveUser = {
        ...(draft as ExecutiveUser),
        id: newUserId(),
        password: draft.password || "senha123",
      };
      persist([...users, created]);
    }
    setDraft(null);
  }

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Gestão de usuários">
      <div className="flex justify-end mb-5">
        <button
          type="button"
          onClick={() => setDraft({ ...emptyDraft })}
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
              <th className="text-left px-4 py-3 font-normal">Usuário</th>
              <th className="text-left px-4 py-3 font-normal">Slug</th>
              <th className="text-left px-4 py-3 font-normal">Perfil</th>
              <th className="text-left px-4 py-3 font-normal">Status</th>
              <th className="text-right px-4 py-3 font-normal">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[color:var(--border)]/60 last:border-0">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{u.username}</td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)] font-mono text-xs">
                  /{u.slug}
                </td>
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
                    <button
                      onClick={() => setDraft({ ...u })}
                      title="Editar"
                      className="rounded-lg p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)]/60"
                    >
                      <Pencil className="h-4 w-4" />
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--navy-deep)]/70 backdrop-blur-sm p-6">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] p-6 space-y-4">
            <h3 className="font-display text-lg">
              {draft.id ? "Editar usuário" : "Novo usuário"}
            </h3>
            {(
              [
                ["name", "Nome"],
                ["username", "Usuário"],
                ["password", "Senha"],
                ["slug", "Slug personalizado"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1.5">
                  {label}
                </label>
                <input
                  type="text"
                  value={(draft as Record<string, string>)[field] ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [field]: e.target.value } as Draft)
                  }
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50"
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
                  <option value="executivo">Executivo de Expansão</option>
                  <option value="diretora">Diretora de Expansão</option>
                  <option value="super_admin">Super Administrador</option>
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
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </ExecutiveShell>
  );
}