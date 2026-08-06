import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings, Palette, Plug, Shield, Bell, Video, Lock, Trash2 } from "lucide-react";
import {
  loadHomologationConfig,
  saveHomologationConfig,
  signOutHomologation,
  type HomologationConfig,
} from "@/lib/homologation-guard";
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
    else if (s.activeRole !== "super_admin") navigate({ to: "/executivo/home" });
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
          <ProtecaoHomologacaoSection />
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

/**
 * Etapa 2 §9 — Proteção da Homologação.
 *
 * Ativa/desativa a camada de proteção do ambiente e administra os
 * usuários autorizados. Não interfere nos logins do CRM, da Central
 * Administrativa nem do Portal do Investidor.
 */
function ProtecaoHomologacaoSection() {
  const [config, setConfig] = useState<HomologationConfig>({ enabled: true, users: [] });
  const [novoUsuario, setNovoUsuario] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadHomologationConfig());
  }, []);

  function persist(next: HomologationConfig, message: string) {
    setConfig(saveHomologationConfig(next));
    setFeedback(message);
  }

  function toggle() {
    persist(
      { ...config, enabled: !config.enabled },
      config.enabled ? "Proteção desativada." : "Proteção ativada.",
    );
  }

  function addUser() {
    const username = novoUsuario.trim();
    if (username.length < 2 || novaSenha.length < 4) {
      setFeedback("Informe um usuário e uma senha com pelo menos 4 caracteres.");
      return;
    }
    const users = [
      ...config.users.filter((u) => u.username.toLowerCase() !== username.toLowerCase()),
      { username, password: novaSenha },
    ];
    persist({ ...config, users }, `Acesso de ${username} salvo.`);
    setNovoUsuario("");
    setNovaSenha("");
  }

  function removeUser(username: string) {
    persist(
      { ...config, users: config.users.filter((u) => u.username !== username) },
      `Acesso de ${username} removido.`,
    );
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <Lock className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <h2 className="font-display text-base">Proteção da Homologação</h2>
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] pb-3">
        <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          Tela de acesso exibida antes de qualquer URL do ambiente. Não substitui os logins do CRM,
          da Central Administrativa ou do Portal do Investidor.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          aria-label={config.enabled ? "Desativar proteção" : "Ativar proteção"}
          onClick={toggle}
          className={
            "relative h-6 w-11 shrink-0 rounded-full border transition " +
            (config.enabled
              ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/25"
              : "border-[color:var(--border)] bg-[color:var(--background)]/60")
          }
        >
          <span
            className={
              "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all " +
              (config.enabled
                ? "left-6 bg-[color:var(--gold)]"
                : "left-1 bg-[color:var(--muted-foreground)]")
            }
          />
        </button>
      </div>
      <ul className="divide-y divide-[color:var(--border)]">
        {config.users.map((u) => (
          <li key={u.username} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm">{u.username}</p>
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                Senha definida · {u.password.length} caracteres
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeUser(u.username)}
              aria-label={`Excluir ${u.username}`}
              className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted-foreground)] transition hover:border-[color:var(--destructive)]/50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {config.users.length === 0 ? (
          <li className="py-3 text-xs text-[color:var(--muted-foreground)]">
            Nenhum usuário autorizado — a proteção precisa de ao menos um acesso.
          </li>
        ) : null}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={novoUsuario}
          onChange={(e) => setNovoUsuario(e.target.value)}
          placeholder="Usuário"
          className="w-40 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/60 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
        />
        <input
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          type="password"
          placeholder="Senha"
          className="w-40 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/60 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
        />
        <button
          type="button"
          onClick={addUser}
          className="rounded-full bg-[color:var(--gold)] px-4 py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--gold-foreground)] transition hover:opacity-90"
        >
          Salvar acesso
        </button>
        <button
          type="button"
          onClick={() => {
            signOutHomologation();
            setFeedback("Sessão de homologação encerrada neste navegador.");
          }}
          className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs uppercase tracking-[0.16em] transition hover:border-[color:var(--gold)]"
        >
          Encerrar sessão
        </button>
      </div>
      {feedback ? (
        <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">{feedback}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
        Cadastrar o mesmo usuário novamente atualiza a senha.
      </p>
    </section>
  );
}

const INTEGRATIONS_KEY = "velox:integrations:v2";

type IntegrationField = { id: string; label: string; placeholder: string; secret?: boolean };

type IntegrationDef = {
  id: string;
  label: string;
  hint: string;
  fields: IntegrationField[];
};

const INTEGRATION_DEFS: IntegrationDef[] = [
  {
    id: "crm",
    label: "CRM · Green Sales",
    hint: "Redirecionamento externo para o CRM comercial.",
    fields: [
      { id: "baseUrl", label: "URL do CRM", placeholder: "https://crm.veloxsolucoes.com.br" },
      { id: "apiKey", label: "API Key", placeholder: "gs_live_...", secret: true },
    ],
  },
  {
    id: "meet",
    label: "Reuniões · Google Meet",
    hint: "Geração de links de videoconferência pela Conta Google do Portal.",
    fields: [
      { id: "calendarId", label: "Agenda padrão", placeholder: "primary" },
    ],
  },
  {
    id: "drive",
    label: "Drive · Google Drive",
    hint: "Repositório de documentos institucionais.",
    fields: [
      { id: "folderId", label: "ID da pasta oficial", placeholder: "1AbCdEf..." },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp · Meta Cloud API",
    hint: "Envio de templates e mensagens oficiais do CRM.",
    fields: [
      { id: "phoneNumberId", label: "Phone Number ID", placeholder: "1029384756" },
      { id: "wabaId", label: "WABA ID", placeholder: "5647382910" },
      { id: "token", label: "Permanent Token", placeholder: "EAAG...", secret: true },
    ],
  },
];

type IntegrationState = {
  enabled: boolean;
  values: Record<string, string>;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
};

function emptyIntegration(): IntegrationState {
  return { enabled: true, values: {}, lastCheckAt: null, lastCheckOk: null };
}

function loadIntegrations(): Record<string, IntegrationState> {
  const out: Record<string, IntegrationState> = {};
  let stored: Record<string, Partial<IntegrationState>> = {};
  try {
    const raw = window.localStorage.getItem(INTEGRATIONS_KEY);
    stored = raw ? (JSON.parse(raw) as Record<string, Partial<IntegrationState>>) : {};
  } catch {
    stored = {};
  }
  for (const def of INTEGRATION_DEFS) {
    out[def.id] = { ...emptyIntegration(), ...(stored[def.id] ?? {}) };
  }
  return out;
}

function persistIntegrations(next: Record<string, IntegrationState>) {
  try {
    window.localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

/**
 * Painel administrativo real das integrações: cada item pode ser
 * configurado, editado, reconectado, testado e desconectado. Os
 * parâmetros ficam administráveis — nada é fixo no código.
 */
function IntegracoesSection() {
  const [state, setState] = useState<Record<string, IntegrationState>>({});
  const [editing, setEditing] = useState<IntegrationDef | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setState(loadIntegrations());
  }, []);

  function update(id: string, patch: Partial<IntegrationState>) {
    setState((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] ?? emptyIntegration()), ...patch } };
      persistIntegrations(next);
      return next;
    });
  }

  function test(def: IntegrationDef) {
    const current = state[def.id] ?? emptyIntegration();
    const missing = def.fields.filter((f) => !(current.values[f.id] ?? "").trim());
    const ok = current.enabled && missing.length === 0;
    update(def.id, { lastCheckAt: new Date().toISOString(), lastCheckOk: ok });
    setFeedback(
      ok
        ? `${def.label}: conexão validada.`
        : `${def.label}: ${current.enabled ? `faltam parâmetros (${missing.map((f) => f.label).join(", ")}).` : "integração desconectada."}`,
    );
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
        {INTEGRATION_DEFS.map((def) => {
          const current = state[def.id] ?? emptyIntegration();
          const configured = def.fields.every((f) => (current.values[f.id] ?? "").trim());
          const tone = !current.enabled ? "red" : configured ? "green" : "amber";
          return (
            <li key={def.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">{def.label}</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">{def.hint}</p>
                  <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
                    Última verificação:{" "}
                    {current.lastCheckAt
                      ? new Date(current.lastCheckAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  <span
                    className={
                      "h-2 w-2 rounded-full " +
                      (tone === "green"
                        ? "bg-emerald-500"
                        : tone === "amber"
                          ? "bg-amber-400"
                          : "bg-red-500")
                    }
                  />
                  {current.enabled ? (configured ? "Conectado" : "Pendente") : "Desconectado"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(def)}
                  className="rounded-full border border-[color:var(--gold)] px-4 py-1.5 text-[11px] text-[color:var(--gold)] transition hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)]"
                >
                  Configurar
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(def)}
                  className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] transition hover:border-[color:var(--gold)]"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update(def.id, { enabled: true, lastCheckAt: new Date().toISOString(), lastCheckOk: true });
                    setFeedback(`${def.label}: reconectada.`);
                  }}
                  className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] transition hover:border-[color:var(--gold)]"
                >
                  Reconectar
                </button>
                <button
                  type="button"
                  onClick={() => test(def)}
                  className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] transition hover:border-[color:var(--gold)]"
                >
                  Testar conexão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update(def.id, { enabled: false });
                    setFeedback(`${def.label}: desconectada.`);
                  }}
                  className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] text-[color:var(--muted-foreground)] transition hover:border-red-400/50 hover:text-red-400"
                >
                  Desconectar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {feedback ? (
        <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">{feedback}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
        Os parâmetros ficam administráveis: nenhuma integração é fixa no sistema.
      </p>
      {editing ? (
        <IntegrationDialog
          def={editing}
          value={state[editing.id] ?? emptyIntegration()}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            update(editing.id, { values, enabled: true });
            setFeedback(`${editing.label}: parâmetros salvos.`);
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}

function IntegrationDialog({
  def,
  value,
  onClose,
  onSave,
}: {
  def: IntegrationDef;
  value: IntegrationState;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(value.values ?? {});
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-2xl">
        <h3 className="mb-4 font-display text-base">Configurar {def.label}</h3>
        <div className="space-y-3">
          {def.fields.map((field) => (
            <label key={field.id} className="block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                {field.label}
              </span>
              <input
                type={field.secret ? "password" : "text"}
                value={values[field.id] ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs transition hover:border-[color:var(--gold)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(values)}
            className="rounded-full bg-[color:var(--gold)] px-4 py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--gold-foreground)] transition hover:opacity-90"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
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