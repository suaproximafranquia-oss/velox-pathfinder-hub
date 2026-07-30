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
          Painel administrativo. Videoconferência e Integrações são editáveis; as
          demais seções permanecem informativas nesta versão.
        </p>
        <div className="grid gap-4">
          <VideoconferenciaSection session={session} />
          <IntegracoesSection />
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

function VideoconferenciaSection({ session }: { session: ExecutiveSession }) {
  return <VideoconferenciaSectionInner session={session} />;
}

const INTEGRATIONS_KEY = "velox:integrations:v1";

const INTEGRATION_DEFS = [
  { id: "crm", label: "CRM · Green Sales", hint: "Redirecionamento externo para o CRM comercial." },
  { id: "meet", label: "Reuniões · Google Meet", hint: "Geração de links de videoconferência." },
  { id: "drive", label: "Drive · Google Drive", hint: "Repositório de documentos institucionais." },
] as const;

type IntegrationId = (typeof INTEGRATION_DEFS)[number]["id"];

function IntegracoesSection() {
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INTEGRATIONS_KEY);
      setState(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setState({});
    }
  }, []);

  function toggle(id: IntegrationId) {
    setState((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      try {
        window.localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <Plug className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <h2 className="font-display text-base">Integrações</h2>
      </div>
      <ul className="divide-y divide-[color:var(--border)]">
        {INTEGRATION_DEFS.map((it) => {
          const active = state[it.id] ?? true;
          return (
            <li key={it.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">{it.label}</p>
                <p className="text-[11px] text-[color:var(--muted-foreground)]">{it.hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label={`${active ? "Desativar" : "Ativar"} ${it.label}`}
                onClick={() => toggle(it.id)}
                className={
                  "relative h-6 w-11 shrink-0 rounded-full border transition " +
                  (active
                    ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/25"
                    : "border-[color:var(--border)] bg-[color:var(--background)]/60")
                }
              >
                <span
                  className={
                    "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all " +
                    (active
                      ? "left-6 bg-[color:var(--gold)]"
                      : "left-1 bg-[color:var(--muted-foreground)]")
                  }
                />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">
        As alterações são aplicadas imediatamente neste workspace.
      </p>
    </section>
  );
}

function VideoconferenciaSectionInner({ session }: { session: ExecutiveSession }) {
  const [providerId, setProviderId] = useState<MeetingProviderId>(
    () => getDefaultProviderForExecutive(session.userId),
  );
  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <Video className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <h2 className="font-display text-base">Videoconferência</h2>
      </div>
      <p className="text-xs text-[color:var(--muted-foreground)] mb-3 leading-relaxed">
        Provedor padrão utilizado ao criar novas reuniões. É possível alterar por reunião no formulário de criação.
      </p>
      <label className="block text-sm">
        <span className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1">
          Provedor padrão
        </span>
        <select
          value={providerId}
          onChange={(e) => {
            const next = e.target.value as MeetingProviderId;
            setProviderId(next);
            setDefaultProviderForExecutive(session.userId, next);
          }}
          className="w-full max-w-sm rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
        >
          {MEETING_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.enabled}>
              {p.label}{p.comingSoon ? " — em breve" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
        Google Meet gera o link automaticamente quando a integração Google
        Workspace estiver conectada. Enquanto isso, o link pode ser informado
        manualmente na própria reunião.
      </p>
    </section>
  );
}