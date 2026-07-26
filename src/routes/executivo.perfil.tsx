import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserCircle2, Mail, Briefcase, Phone, Calendar, Shield } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  loadUsers,
  ROLE_LABEL,
  type ExecutiveSession,
  type ExecutiveUser,
} from "@/lib/executive-auth";

export const Route = createFileRoute("/executivo/perfil")({
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
  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);
  if (!session) return null;
  const user = loadUsers().find((u) => u.id === session.userId) ?? null;
  return (
    <ExecutiveShell session={session} title="Meu Perfil">
      <div className="max-w-3xl">
        <p className="text-sm text-[color:var(--muted-foreground)] mb-8 leading-relaxed">
          Seus dados pessoais alimentam os módulos de reconhecimento, notificações
          e comunicação corporativa. Nesta versão os campos são somente leitura —
          a edição será liberada junto com o módulo de Configurações.
        </p>
        <ProfileFields session={session} user={user} />
        <IntegrationsSection />
      </div>
    </ExecutiveShell>
  );
}

function ProfileFields({
  session,
  user,
}: {
  session: ExecutiveSession;
  user: ExecutiveUser | null;
}) {
  const rows = [
    { icon: UserCircle2, label: "Nome completo", value: session.name },
    { icon: Mail, label: "E-mail corporativo", value: user?.email ?? "—" },
    {
      icon: Briefcase,
      label: "Cargo / Perfil",
      value: ROLE_LABEL[session.activeRole],
    },
    { icon: Phone, label: "Telefone / WhatsApp", value: "A cadastrar" },
    {
      icon: Calendar,
      label: "Data de aniversário",
      value: "A cadastrar (usado pelo Achievement Engine)",
    },
    {
      icon: Shield,
      label: "Permissões atuais",
      value: ROLE_LABEL[session.activeRole],
    },
  ];
  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 divide-y divide-[color:var(--border)]/60">
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <div key={r.label} className="flex items-center gap-4 px-5 py-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
              <Icon className="h-4 w-4" strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                {r.label}
              </p>
              <p className="text-sm mt-0.5">{r.value}</p>
            </div>
          </div>
        );
      })}
    </section>
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