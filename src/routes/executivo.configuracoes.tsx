import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings, Palette, Plug, Shield, Bell, Video } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  canManageUsers,
  getSession,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { WORKSPACE } from "@/config/workspace";
import {
  MEETING_PROVIDERS,
  getDefaultProviderForExecutive,
  setDefaultProviderForExecutive,
  type MeetingProviderId,
} from "@/lib/meeting-providers";

export const Route = createFileRoute("/executivo/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Atlas Platform" },
      {
        name: "description",
        content:
          "Preferências administrativas do workspace: identidade visual, integrações, permissões e notificações.",
      },
      { property: "og:title", content: "Configurações — Atlas Platform" },
      {
        property: "og:description",
        content:
          "Preferências administrativas do workspace: identidade visual, integrações, permissões e notificações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else if (!canManageUsers(s.activeRole)) navigate({ to: "/executivo/home" });
    else setSession(s);
  }, [navigate]);
  if (!session) return null;

  const sections = [
    {
      icon: Palette,
      title: "Identidade Visual (White Label)",
      lines: [
        `Workspace: ${WORKSPACE.workspaceName}`,
        `Assinatura: ${WORKSPACE.workspaceTagline}`,
        `Rodapé: ${WORKSPACE.poweredBy}`,
      ],
    },
    {
      icon: Plug,
      title: "Integrações",
      lines: [
        "CRM · Green Sales — redirecionamento externo ativo",
        "Reuniões · Google Meet — redirecionamento externo ativo",
        "Drive · Google Drive — redirecionamento externo ativo",
      ],
    },
    {
      icon: Shield,
      title: "Permissões",
      lines: [
        "Administrador · acesso total à plataforma",
        "Gestor · consolidação da equipe operacional",
        "Colaborador · acesso apenas aos próprios indicadores",
      ],
    },
    {
      icon: Bell,
      title: "Notificações & Reconhecimentos",
      lines: [
        "Aniversário: aviso automático no primeiro login do dia",
        "KPI Pendente: aviso quando indicadores do dia anterior não foram registrados",
      ],
    },
  ];

  return (
    <ExecutiveShell session={session} title="Configurações do Workspace">
      <div className="max-w-3xl">
        <p className="text-sm text-[color:var(--muted-foreground)] mb-8 leading-relaxed flex items-center gap-2">
          <Settings className="h-4 w-4 text-[color:var(--gold)]" />
          Painel administrativo. Nesta versão as seções são somente leitura —
          preparadas para receberem edição na próxima sprint.
        </p>
        <div className="grid gap-4">
          <VideoconferenciaSection session={session} />
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <section
                key={s.title}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <h2 className="font-display text-base">{s.title}</h2>
                </div>
                <ul className="space-y-1.5 text-sm text-[color:var(--muted-foreground)] pl-1">
                  {s.lines.map((l) => (
                    <li key={l} className="leading-relaxed">
                      · {l}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </ExecutiveShell>
  );
}