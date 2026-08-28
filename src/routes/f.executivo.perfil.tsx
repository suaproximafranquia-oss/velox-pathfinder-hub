import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  UserCircle2,
  Mail,
  Briefcase,
  MessageCircle,
  Calendar,
  Cake,
  Shield,
  Pencil,
  Check,
  X,
  Lock,
  Upload,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { GoogleWorkspaceCard } from "@/components/executive/google-workspace-card";
import { CrmThemePicker } from "@/components/executive/crm-theme-picker";
import { ExecutivePhotoCard } from "@/components/executive/executive-photo-card";
import { uploadPostPresentationVideo } from "@/lib/executive-video.functions";
import {
  getSession,
  loadUsers,
  saveUsers,
  ROLE_LABEL,
  type ExecutiveSession,
  type ExecutiveUser,
} from "@/lib/executive-auth";

export const Route = createFileRoute("/f/executivo/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — Atlas Platform" },
      {
        name: "description",
        content:
          "Dados pessoais, contato e preferências do colaborador dentro do workspace.",
      },
      { property: "og:title", content: "Meu Perfil — Atlas Platform" },
      {
        property: "og:description",
        content: "Dados pessoais e preferências do colaborador no workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [user, setUser] = useState<ExecutiveUser | null>(null);
  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/f/executivo" });
    else {
      setSession(s);
      setUser(loadUsers().find((u) => u.id === s.userId) ?? null);
    }
  }, [navigate]);
  if (!session) return null;
  // Personalização do CRM, Integrações e Conta Google são áreas
  // administrativas: visíveis apenas para Administrador e Gestora.
  const isAdminProfile =
    session.activeRole === "super_admin" || session.activeRole === "diretora";
  return (
    <ExecutiveShell session={session} title="Meu Perfil">
      <div className="max-w-3xl">
        <p className="text-sm text-[color:var(--muted-foreground)] mb-8 leading-relaxed">
          Este perfil é a fonte única dos seus dados na plataforma. Nome,
          e-mail, WhatsApp, data de nascimento e data de admissão
          utilizados por qualquer módulo (Manual personalizado,
          Recognition, IA, etc.) vêm diretamente daqui. Para alterá-los,
          utilize o botão “Editar Perfil”.
        </p>
        <ExecutivePhotoCard
          user={user}
          fallbackName={session.name}
          onChange={setUser}
        />
        <div className="h-6" />
        <ProfileFields
          session={session}
          user={user}
          onChange={(u) => {
            setUser(u);
            const s = getSession();
            if (s) setSession(s);
          }}
        />
        {isAdminProfile && (
          <>
            <CrmThemePicker userId={session.userId} />
            <IntegrationsSection />
            <GoogleWorkspaceCard session={session} />
          </>
        )}
      </div>
    </ExecutiveShell>
  );
}

function ProfileFields({
  session,
  user,
  onChange,
}: {
  session: ExecutiveSession;
  user: ExecutiveUser | null;
  onChange: (u: ExecutiveUser) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: user?.name ?? session.name,
    email: user?.email ?? session.email,
    whatsapp: user?.whatsapp ?? user?.phone ?? "",
    admissionDate: user?.admissionDate ?? "",
    birthDate: user?.birthDate ?? "",
    postPresentationVideoUrl: user?.postPresentationVideoUrl ?? "",
  });

  function startEdit() {
    setDraft({
      name: user?.name ?? session.name,
      email: user?.email ?? session.email,
      whatsapp: user?.whatsapp ?? user?.phone ?? "",
      admissionDate: user?.admissionDate ?? "",
      birthDate: user?.birthDate ?? "",
      postPresentationVideoUrl: user?.postPresentationVideoUrl ?? "",
    });
    setEditing(true);
  }
  function cancel() {
    setEditing(false);
  }
  function save() {
    if (!user) return;
    const updated: ExecutiveUser = {
      ...user,
      name: draft.name.trim() || user.name,
      email: draft.email.trim().toLowerCase() || user.email,
      whatsapp: draft.whatsapp.trim() || undefined,
      admissionDate: draft.admissionDate || undefined,
      birthDate: draft.birthDate || undefined,
      // COMANDO 3D §17 — link individual, sem fallback de outro executivo.
      postPresentationVideoUrl: draft.postPresentationVideoUrl.trim() || undefined,
    };
    const all = loadUsers().map((u) => (u.id === updated.id ? updated : u));
    saveUsers(all);
    onChange(updated);
    setEditing(false);
  }

  type EditableKey =
    | "name"
    | "email"
    | "whatsapp"
    | "admissionDate"
    | "birthDate"
    | "postPresentationVideoUrl";
  const rows: Array<{
    icon: typeof UserCircle2;
    label: string;
    value: string;
    editable?: EditableKey;
    inputType?: string;
    locked?: boolean;
  }> = [
    { icon: UserCircle2, label: "Nome completo", value: user?.name ?? session.name, editable: "name" },
    { icon: Mail, label: "E-mail corporativo", value: user?.email ?? "—", editable: "email", inputType: "email" },
    {
      icon: Briefcase,
      label: "Cargo",
      value: user?.title ?? "—",
      locked: true,
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: user?.whatsapp ?? user?.phone ?? "A cadastrar",
      editable: "whatsapp",
      inputType: "tel",
    },
    {
      icon: Cake,
      label: "Data de nascimento",
      value: user?.birthDate
        ? new Date(user.birthDate).toLocaleDateString("pt-BR")
        : "A cadastrar",
      editable: "birthDate",
      inputType: "date",
    },
    {
      icon: Calendar,
      label: "Data de admissão",
      value: user?.admissionDate
        ? new Date(user.admissionDate).toLocaleDateString("pt-BR")
        : "A cadastrar",
      editable: "admissionDate",
      inputType: "date",
    },
    {
      icon: Shield,
      label: "Permissões atuais",
      value: ROLE_LABEL[session.activeRole],
    },
    {
      icon: MessageCircle,
      label: "Vídeo de pós-apresentação (individual)",
      value:
        user?.postPresentationVideoUrl ??
        "Vídeo de pós-apresentação não configurado para este executivo.",
      editable: "postPresentationVideoUrl",
      inputType: "url",
    },
  ];
  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--border)]/60">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Dados do colaborador
        </p>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
          >
            <Pencil className="h-3 w-3" /> Editar Perfil
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
            >
              <X className="h-3 w-3" /> Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--gold)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--navy-deep)] hover:bg-[color:var(--gold)]/90 transition"
            >
              <Check className="h-3 w-3" /> Salvar
            </button>
          </div>
        )}
      </div>
      <div className="divide-y divide-[color:var(--border)]/60">
      {rows.map((r) => {
        const Icon = r.icon;
        const isEditing = editing && !!r.editable;
        return (
          <div key={r.label} className="flex items-center gap-4 px-5 py-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
              <Icon className="h-4 w-4" strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] flex items-center gap-1.5">
                {r.label}
                {editing && r.locked && (
                  <Lock className="h-3 w-3 text-[color:var(--muted-foreground)]/60" />
                )}
              </p>
              {isEditing && r.editable ? (
                <input
                  type={r.inputType ?? "text"}
                  value={draft[r.editable]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [r.editable as EditableKey]: e.target.value }))
                  }
                  className="mt-0.5 w-full bg-transparent border-b border-[color:var(--gold)]/40 text-sm outline-none py-0.5"
                />
              ) : (
                <p className="text-sm mt-0.5 break-all">{r.value}</p>
              )}
              {r.editable === "postPresentationVideoUrl" && isEditing && (
                <VideoUploadButton
                  executiveId={user?.id ?? "executivo"}
                  onUploaded={(url) =>
                    setDraft((d) => ({ ...d, postPresentationVideoUrl: url }))
                  }
                />
              )}
            </div>
          </div>
        );
      })}
      </div>
    </section>
  );
}

/** Upload direto do vídeo individual — sem depender de hospedagem externa. */
function VideoUploadButton({
  executiveId,
  onUploaded,
}: {
  executiveId: string;
  onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });
      const { url } = await uploadPostPresentationVideo({
        data: {
          executiveId,
          fileName: file.name,
          mimeType: file.type || "video/mp4",
          base64,
        },
      });
      onUploaded(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar o vídeo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 flex items-center gap-3">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition">
        <Upload className="h-3 w-3" />
        {busy ? "Enviando vídeo…" : "Enviar vídeo"}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pick(file);
            e.target.value = "";
          }}
        />
      </label>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}

function IntegrationsSection() {
  const integrations = [
    { name: "Green Sales (CRM)", status: "Redirecionamento externo ativo" },
    { name: "Google Meet (Reuniões)", status: "Redirecionamento externo ativo" },
    { name: "Google Drive (Downloads)", status: "Redirecionamento externo ativo" },
  ];
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg mb-3">Integrações do workspace</h2>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 divide-y divide-[color:var(--border)]/60">
        {integrations.map((i) => (
          <div key={i.name} className="flex items-center justify-between px-5 py-3">
            <p className="text-sm">{i.name}</p>
            <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              {i.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}